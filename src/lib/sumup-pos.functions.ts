import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guessCategory } from "@/lib/cooking";

export type PosSide = "jury" | "judge" | "public";

type SumupTxn = {
  id: string;
  transaction_code?: string;
  amount: number;
  currency: string;
  status: string; // SUCCESSFUL, FAILED, PENDING, CANCELLED
  timestamp: string;
  product_summary?: string;
  payment_type?: string;
  entry_mode?: string;
  card?: { last_4_digits?: string; type?: string };
  products?: Array<{
    name: string;
    description?: string;
    quantity?: number;
    price?: number;
    /** Free-text note the till operator added to this line. Field name varies. */
    comment?: string;
    note?: string;
    notes?: string;
    remark?: string;
    modifiers?: Array<string | { name?: string; comment?: string }>;
    /** SumUp's product catalogue category; the field name varies by product. */
    category?: string;
    category_name?: string;
    categories?: Array<string | { name?: string }>;
  }>;
  internal_id?: string | number;
  /** Order-level note from the SumUp till. Field name varies by product. */
  description?: string;
  comment?: string;
  note?: string;
  notes?: string;
  tip_amount?: number;
  // Terminal / reader identity varies by SumUp product; we probe a few shapes.
  reader_id?: string;
  device?: { identifier?: string; id?: string; model?: string };
  terminal?: { id?: string; name?: string };
  /** SumUp account signed in on the till that rang the sale up. */
  username?: string;
  /** e.g. urn:sumup:pos:sale:<merchant>:<pos-device-uuid>:<ts> */
  client_transaction_id?: string;
  local_time?: string;
  /** Amount already refunded against this payment (SumUp keeps status SUCCESSFUL). */
  refunded_amount?: number;
  /** PAYMENT | REFUND */
  type?: string;
};

/** Reads whichever category field this SumUp basket line happens to carry. */
function sumupCategory(p: NonNullable<SumupTxn["products"]>[number]): string | null {
  const first = p.categories?.[0];
  const fromList = typeof first === "string" ? first : first?.name;
  const label = (p.category ?? p.category_name ?? fromList ?? "").trim();
  return label || null;
}

/** Reads whichever note/comment field a SumUp basket line happens to carry. */
function sumupLineNote(p: NonNullable<SumupTxn["products"]>[number]): string | null {
  const mods = (p.modifiers ?? [])
    .map((m) => (typeof m === "string" ? m : [m?.name, m?.comment].filter(Boolean).join(" ")))
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  const parts = [p.description, p.comment, p.note, p.notes, p.remark, ...mods]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique = parts.filter((s) => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.length ? unique.join(" · ") : null;
}

/** Reads whichever order-level note the SumUp till sent with the sale. */
function sumupOrderNote(t: SumupTxn): string | null {
  const note = [t.description, t.comment, t.note, t.notes]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)[0];
  return note || null;
}

/** A sale is void when SumUp cancelled/failed it, or the full amount was refunded. */
function isVoidTxn(t: Pick<SumupTxn, "status" | "amount" | "refunded_amount">): "refunded" | "cancelled" | null {
  const st = String(t.status ?? "").toUpperCase();
  if (st === "REFUNDED") return "refunded";
  if (st === "CANCELLED" || st === "CANCELED" || st === "FAILED") return "cancelled";
  const refunded = Number(t.refunded_amount ?? 0);
  if (refunded > 0 && refunded >= Number(t.amount) - 0.001) return "refunded";
  return null;
}

/** Anything that could identify which physical terminal took the sale. */
function deviceRefs(t: SumupTxn): string[] {
  return [
    t.reader_id,
    t.device?.identifier,
    t.device?.id,
    t.terminal?.id,
    t.terminal?.name,
    // The SumUp account signed in on that till — the reliable per-counter signal.
    t.username,
  ].filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/**
 * Work out which counter (jury side or public side) rang the sale up:
 * first by the mapped terminal reference, then by any keyword the terminal
 * puts in the sale text. Null when we genuinely can't tell.
 */
function derivePosSide(
  t: SumupTxn,
  products: SumupTxn["products"],
  mapping: Map<string, PosSide>,
): PosSide | null {
  for (const ref of deviceRefs(t)) {
    const hit = mapping.get(ref.toLowerCase());
    if (hit) return hit;
  }
  const haystack = [
    t.product_summary ?? "",
    String(t.internal_id ?? ""),
    ...deviceRefs(t),
    ...(products ?? []).map((p) => p?.name ?? ""),
    ...(products ?? []).map((p) => p?.description ?? ""),
  ]
    .join(" | ")
    .toLowerCase();
  if (/\bjury\b/.test(haystack)) return "jury";
  if (/\bjudge(s)?\b/.test(haystack)) return "judge";
  if (/\bpublic\b/.test(haystack)) return "public";
  return null;
}

/**
 * Derive the fulfilment type for a SumUp POS sale from whatever the terminal sends
 * (product summary, line-item names, or the terminal's internal reference).
 * Falls back to collection (counter sale) when the terminal gives no hint.
 */
function deriveFulfilment(t: SumupTxn, products: SumupTxn["products"]): {
  type: "dine_in" | "collection" | "delivery";
  table_number: string | null;
} {
  const haystack = [
    t.product_summary ?? "",
    String(t.internal_id ?? ""),
    ...(products ?? []).map((p) => p?.name ?? ""),
    // SumUp POS puts the chosen modifier (e.g. "Dine In" / "Takeaway") in the
    // line-item description, not the name.
    ...(products ?? []).map((p) => p?.description ?? ""),
  ]
    .join(" | ")
    .toLowerCase();

  const tableMatch = haystack.match(/\b(?:table|tbl)\s*#?\s*([a-z0-9-]{1,6})\b/i);
  // Terminals send the dine-in / takeaway choice as a modifier line or in the
  // product summary, e.g. "Latte (Takeaway)" or a "Take away" line item.
  const isTakeaway = /\b(take\s*-?\s*away|takeaway|to\s*go|take\s*out|takeout)\b/.test(haystack);
  const isDineIn =
    /\b(dine\s*-?\s*in|dinein|eat\s*-?\s*in|sit\s*-?\s*in|in\s*house|eat\s*here)\b/.test(haystack) ||
    (!!tableMatch && !isTakeaway);
  const isDelivery = /\b(delivery|deliver)\b/.test(haystack);

  if (isDineIn && !isTakeaway) return { type: "dine_in", table_number: tableMatch ? tableMatch[1].toUpperCase() : null };
  if (isTakeaway) return { type: "collection", table_number: null };
  if (isDelivery) return { type: "delivery", table_number: null };
  return { type: "collection", table_number: null };
}

/** Builds a UTC Date for a wall-clock time on a given day in Europe/London. */
function londonTimeToUtc(reference: Date, hours: number, minutes: number): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const y = get("year");
  const m = get("month");
  const d = get("day");
  // Guess UTC, then correct by the zone offset at that instant.
  const guess = Date.UTC(y, m - 1, d, hours, minutes, 0, 0);
  const asLondon = new Date(
    new Date(guess).toLocaleString("en-US", { timeZone: "Europe/London" }),
  ).getTime();
  const asUtc = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(guess - (asLondon - asUtc));
}

/**
 * Pre-orders from the SumUp till: the operator types the wanted time into the
 * sale note or a line description, e.g. "LATER 14:30", "FOR 2:30pm", "@ 14:30".
 * Times already passed roll over to the next day, matching the Till app.
 */
function deriveSchedule(
  t: SumupTxn,
  products: SumupTxn["products"],
): { schedule_mode: "asap" | "scheduled"; scheduled_for: string | null } {
  const haystack = [
    sumupOrderNote(t) ?? "",
    t.product_summary ?? "",
    ...(products ?? []).map((p) => sumupLineNote(p) ?? ""),
  ].join(" | ");

  const m = haystack.match(
    /\b(?:later|pre[-\s]?order|preorder|for|due|@|at)\s*:?\s*(\d{1,2})[:.\s]?(\d{2})?\s*(am|pm)?\b/i,
  );
  if (!m) return { schedule_mode: "asap", scheduled_for: null };

  let hh = Number(m[1]);
  const mm = Number(m[2] ?? "0");
  const suffix = (m[3] ?? "").toLowerCase();
  if (suffix === "pm" && hh < 12) hh += 12;
  if (suffix === "am" && hh === 12) hh = 0;
  if (hh > 23 || mm > 59) return { schedule_mode: "asap", scheduled_for: null };

  const placed = t.timestamp ? new Date(t.timestamp) : new Date();
  let when = londonTimeToUtc(placed, hh, mm);
  // Ignore near-immediate times; roll anything already gone to tomorrow.
  if (when.getTime() - placed.getTime() < 5 * 60 * 1000) {
    when = londonTimeToUtc(new Date(placed.getTime() + 24 * 60 * 60 * 1000), hh, mm);
  }
  return { schedule_mode: "scheduled", scheduled_for: when.toISOString() };
}

export const syncSumupPos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env.SUMUP_API_KEY;
    if (!key) return { imported: 0, skipped: 0, error: "SUMUP_API_KEY not set" };

    // Housekeeping: drop website orders left unpaid for more than 5 minutes.
    try {
      const { purgeStaleUnpaidOrders } = await import("./order-cleanup.server");
      await purgeStaleUnpaidOrders();
    } catch (e) {
      console.error("[pos-sync] unpaid purge failed", e);
    }

    // Verify caller is staff/admin (RLS-scoped supabase from middleware)
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isStaff } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" });
    if (!isAdmin && !isStaff) throw new Error("Forbidden");

    // Pull the last 24h of transactions, NEWEST FIRST and paginated. SumUp
    // returns the oldest rows of the window by default, so a busy day pushes
    // the newest sales off the first page and they never reach the kitchen.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const base = "https://api.sumup.com/v0.1/me/transactions/history";
    const items: SumupTxn[] = [];
    let next: string | null =
      `?oldest_time=${encodeURIComponent(since)}&limit=100&order=descending`;
    for (let page = 0; page < 5 && next; page++) {
      const res: Response = await fetch(`${base}${next}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        const body = await res.text();
        if (page === 0) {
          return { imported: 0, skipped: 0, error: `SumUp ${res.status}: ${body.slice(0, 200)}` };
        }
        break;
      }
      const payload = (await res.json()) as
        | { items?: SumupTxn[]; links?: Array<{ href?: string; rel?: string }> }
        | SumupTxn[];
      if (Array.isArray(payload)) {
        items.push(...payload);
        next = null;
      } else {
        items.push(...(payload.items ?? []));
        const href = payload.links?.find((l) => l.rel === "next")?.href;
        next = href ? (href.startsWith("?") ? href : `?${href}`) : null;
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Terminal reference → jury/public mapping, configured by staff.
    const { data: devices } = await supabaseAdmin
      .from("pos_devices")
      .select("device_ref, side, active")
      .eq("active", true);
    const mapping = new Map<string, PosSide>(
      (devices ?? []).map((d) => [String(d.device_ref).toLowerCase(), d.side as PosSide]),
    );

    let imported = 0;
    let skipped = 0;
    let voided = 0;

    // Void lookup for everything SumUp returned in the window. SumUp keeps the
    // original PAYMENT row SUCCESSFUL and adds a separate REFUND row with the
    // same transaction_code, so both shapes have to be considered.
    const voidByRef = new Map<string, "refunded" | "cancelled">();
    for (const t of items) {
      const v = isVoidTxn(t);
      if (!v) continue;
      if (t.id) voidByRef.set(t.id, v);
      if (t.transaction_code) voidByRef.set(t.transaction_code, v);
    }

    for (const t of items) {
      if (t.status !== "SUCCESSFUL" || String(t.type ?? "PAYMENT").toUpperCase() === "REFUND") { skipped++; continue; }
      // Already refunded on the terminal — never bring it onto the kitchen display.
      if (isVoidTxn(t) || voidByRef.has(t.transaction_code ?? "") || voidByRef.has(t.id)) { skipped++; continue; }
      // Skip transactions that came from our own website checkout (they already exist as orders).
      // Website checkouts are created via /v0.1/checkouts and reconciled by the webhook using sumup_transaction_id.
      const ref = t.transaction_code ?? t.id;
      // Dedupe against existing orders (either from webhook match or previous sync).
      const { data: existing } = await supabaseAdmin
        .from("orders")
        .select("id")
        .or(`sumup_order_ref.eq.${ref},sumup_transaction_id.eq.${t.id}`)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      // Try to fetch details: the basket, and the SumUp login that took the sale
      // (neither is present on the history listing).
      let products: SumupTxn["products"] = t.products;
      let detailed: SumupTxn = t;
      try {
        const d = await fetch(`https://api.sumup.com/v0.1/me/transactions?id=${encodeURIComponent(t.id)}`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (d.ok) {
          const dj = (await d.json()) as SumupTxn;
          detailed = { ...t, ...dj };
          if (dj.products?.length) products = dj.products;
        }
      } catch { /* ignore detail fetch errors */ }

      const totalCents = Math.round(Number(t.amount) * 100);
      const cardTail = t.card?.last_4_digits ? ` ••${t.card.last_4_digits}` : "";
      const fulfilment = deriveFulfilment(detailed, products);
      const posSide = derivePosSide(detailed, products, mapping);
      const schedule = deriveSchedule(detailed, products);

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("orders")
        .insert({
          customer_name: `SumUp POS${cardTail}`,
          customer_phone: "",
          type: fulfilment.type,
          table_number: fulfilment.table_number,
          pos_terminal: posSide,
          delivery_notes: sumupOrderNote(detailed),
          status: "preparing",
          payment_status: "paid",
          subtotal_cents: totalCents,
          delivery_fee_cents: 0,
          discount_cents: 0,
          promo_discount_cents: 0,
          voucher_cents: 0,
          points_earned: 0,
          total_cents: totalCents,
          schedule_mode: schedule.schedule_mode,
          scheduled_for: schedule.scheduled_for,
          source: "sumup_pos",
          sumup_order_ref: ref,
          sumup_transaction_id: t.id,
          sumup_reference: t.transaction_code ?? null,
        })
        .select("id")
        .single();

      if (insErr || !inserted) { skipped++; continue; }

      // Our own menu is the fallback source of a category when SumUp's basket
      // doesn't carry one, matched on the product name the till sent.
      const { data: menuRows } = await supabaseAdmin
        .from("menu_items")
        .select("id, name, menu_categories(name)");
      const menuByName = new Map<string, Array<{ id: string; category: string | null }>>();
      for (const m of (menuRows ?? []) as Array<{
        id: string;
        name: string;
        menu_categories: { name: string } | null;
      }>) {
        const key = m.name.trim().toLowerCase();
        const matches = menuByName.get(key) ?? [];
        matches.push({
          id: m.id,
          category: m.menu_categories?.name ?? null,
        });
        menuByName.set(key, matches);
      }

      const matchMenuItem = (product: NonNullable<SumupTxn["products"]>[number]) => {
        const matches = menuByName.get((product.name ?? "").trim().toLowerCase()) ?? [];
        if (matches.length === 1) return matches[0];
        const category = sumupCategory(product)?.toLowerCase();
        if (!category) return undefined;
        return matches.find((match) => match.category?.trim().toLowerCase() === category);
      };

      const lines = (products && products.length > 0)
        ? products.map((p) => {
            const matched = matchMenuItem(p);
            return {
              order_id: inserted.id,
              menu_item_id: matched?.id ?? null,
              category_label:
                sumupCategory(p) ?? matched?.category ?? guessCategory(p.name ?? "") ?? null,
              name: p.name || "Item",
              qty: Math.max(1, Number(p.quantity ?? 1)),
              unit_price_cents: Math.round(Number(p.price ?? 0) * 100),
              notes: sumupLineNote(p),
            };
          })
        : [{
            order_id: inserted.id,
            menu_item_id: null as string | null,
            category_label: null as string | null,
            name: t.product_summary || "SumUp POS sale",
            qty: 1,
            unit_price_cents: totalCents,
            notes: null as string | null,
          }];

      await supabaseAdmin.from("order_items").insert(lines);
      imported++;
    }

    // Reconcile: any live ticket (POS or website) whose SumUp transaction is no
    // longer successful (refunded / cancelled / failed) must come off the kitchen display.
    const { data: live } = await supabaseAdmin
      .from("orders")
      .select("id, sumup_transaction_id, sumup_order_ref")
      .or("sumup_transaction_id.not.is.null,sumup_order_ref.not.is.null")
      .in("status", ["paid", "preparing", "ready", "out_for_delivery", "delivered", "completed"]);

    for (const o of live ?? []) {
      const refKey = o.sumup_transaction_id ?? o.sumup_order_ref;
      if (!refKey) continue;
      let voided_as = voidByRef.get(o.sumup_transaction_id ?? "") ?? voidByRef.get(o.sumup_order_ref ?? "");
      const seen = items.some((t) => t.id === o.sumup_transaction_id || t.transaction_code === o.sumup_order_ref);
      if (!voided_as && !seen) {
        // Not in the recent window — ask SumUp directly.
        try {
          const param = o.sumup_transaction_id ? `id=${encodeURIComponent(o.sumup_transaction_id)}` : `transaction_code=${encodeURIComponent(o.sumup_order_ref!)}`;
          const d = await fetch(`https://api.sumup.com/v0.1/me/transactions?${param}`, {
            headers: { Authorization: `Bearer ${key}` },
          });
          if (d.ok) {
            const dj = (await d.json()) as SumupTxn;
            voided_as = isVoidTxn(dj) ?? undefined;
          }
        } catch { /* ignore */ }
      }
      if (voided_as) {
        const refunded = voided_as === "refunded";
        await supabaseAdmin
          .from("orders")
          .update({
            status: refunded ? "refunded" : "cancelled",
            payment_status: refunded ? "refunded" : "failed",
          })
          .eq("id", o.id);
        voided++;
      }
    }

    return { imported, skipped, voided, error: null };
  });