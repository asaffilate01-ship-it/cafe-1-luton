import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    /** SumUp's product catalogue category; the field name varies by product. */
    category?: string;
    category_name?: string;
    categories?: Array<string | { name?: string }>;
  }>;
  internal_id?: string | number;
  tip_amount?: number;
  // Terminal / reader identity varies by SumUp product; we probe a few shapes.
  reader_id?: string;
  device?: { identifier?: string; id?: string; model?: string };
  terminal?: { id?: string; name?: string };
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

    // Pull last 24h of transactions
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const url = new URL("https://api.sumup.com/v0.1/me/transactions/history");
    url.searchParams.set("oldest_time", since);
    url.searchParams.set("limit", "50");

    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) {
      const body = await res.text();
      return { imported: 0, skipped: 0, error: `SumUp ${res.status}: ${body.slice(0, 200)}` };
    }
    const payload = (await res.json()) as { items?: SumupTxn[] } | SumupTxn[];
    const items: SumupTxn[] = Array.isArray(payload) ? payload : (payload.items ?? []);

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

      // Try to fetch details (may include product basket if terminal is SumUp POS/Kiosk).
      let products: SumupTxn["products"] = t.products;
      try {
        const d = await fetch(`https://api.sumup.com/v0.1/me/transactions?id=${encodeURIComponent(t.id)}`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (d.ok) {
          const dj = (await d.json()) as SumupTxn;
          if (dj.products?.length) products = dj.products;
        }
      } catch { /* ignore detail fetch errors */ }

      const totalCents = Math.round(Number(t.amount) * 100);
      const cardTail = t.card?.last_4_digits ? ` ••${t.card.last_4_digits}` : "";
      const fulfilment = deriveFulfilment(t, products);
      const posSide = derivePosSide(t, products, mapping);

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("orders")
        .insert({
          customer_name: `SumUp POS${cardTail}`,
          customer_phone: "",
          type: fulfilment.type,
          table_number: fulfilment.table_number,
          pos_terminal: posSide,
          status: "preparing",
          payment_status: "paid",
          subtotal_cents: totalCents,
          delivery_fee_cents: 0,
          discount_cents: 0,
          promo_discount_cents: 0,
          voucher_cents: 0,
          points_earned: 0,
          total_cents: totalCents,
          schedule_mode: "asap",
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
      const menuByName = new Map<string, { id: string; category: string | null }>();
      for (const m of (menuRows ?? []) as Array<{
        id: string;
        name: string;
        menu_categories: { name: string } | null;
      }>) {
        menuByName.set(m.name.trim().toLowerCase(), {
          id: m.id,
          category: m.menu_categories?.name ?? null,
        });
      }

      const lines = (products && products.length > 0)
        ? products.map((p) => ({
            order_id: inserted.id,
            menu_item_id: menuByName.get((p.name ?? "").trim().toLowerCase())?.id ?? null,
            category_label: sumupCategory(p) ??
              menuByName.get((p.name ?? "").trim().toLowerCase())?.category ?? null,
            name: p.name || "Item",
            qty: Math.max(1, Number(p.quantity ?? 1)),
            unit_price_cents: Math.round(Number(p.price ?? 0) * 100),
            notes: (p.description ?? "").trim() || null,
          }))
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

    // Reconcile: any live POS ticket whose SumUp transaction is no longer
    // successful (refunded / cancelled / failed) must come off the kitchen display.
    const { data: live } = await supabaseAdmin
      .from("orders")
      .select("id, sumup_transaction_id, sumup_order_ref")
      .eq("source", "sumup_pos")
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