import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  products?: Array<{ name: string; quantity?: number; price?: number }>;
  internal_id?: string | number;
  tip_amount?: number;
  // Terminal / reader identity varies by SumUp product; we probe a few shapes.
  reader_id?: string;
  device?: { identifier?: string; id?: string; model?: string };
  terminal?: { id?: string; name?: string };
  local_time?: string;
};

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
  mapping: Map<string, "jury" | "public">,
): "jury" | "public" | null {
  for (const ref of deviceRefs(t)) {
    const hit = mapping.get(ref.toLowerCase());
    if (hit) return hit;
  }
  const haystack = [
    t.product_summary ?? "",
    String(t.internal_id ?? ""),
    ...deviceRefs(t),
    ...(products ?? []).map((p) => p?.name ?? ""),
  ]
    .join(" | ")
    .toLowerCase();
  if (/\bjury\b/.test(haystack)) return "jury";
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
  ]
    .join(" | ")
    .toLowerCase();

  const tableMatch = haystack.match(/\b(?:table|tbl)\s*#?\s*([a-z0-9-]{1,6})\b/i);
  const isDineIn =
    !!tableMatch ||
    /\b(dine\s*-?\s*in|eat\s*-?\s*in|sit\s*-?\s*in|in\s*house)\b/.test(haystack);
  const isDelivery = /\b(delivery|deliver)\b/.test(haystack);

  if (isDineIn) return { type: "dine_in", table_number: tableMatch ? tableMatch[1].toUpperCase() : null };
  if (isDelivery) return { type: "delivery", table_number: null };
  return { type: "collection", table_number: null };
}

export const syncSumupPos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env.SUMUP_API_KEY;
    if (!key) return { imported: 0, skipped: 0, error: "SUMUP_API_KEY not set" };

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
    const mapping = new Map<string, "jury" | "public">(
      (devices ?? []).map((d) => [String(d.device_ref).toLowerCase(), d.side as "jury" | "public"]),
    );

    let imported = 0;
    let skipped = 0;

    for (const t of items) {
      if (t.status !== "SUCCESSFUL") { skipped++; continue; }
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

      const lines = (products && products.length > 0)
        ? products.map((p) => ({
            order_id: inserted.id,
            name: p.name || "Item",
            qty: Math.max(1, Number(p.quantity ?? 1)),
            unit_price_cents: Math.round(Number(p.price ?? 0) * 100),
            notes: null as string | null,
          }))
        : [{
            order_id: inserted.id,
            name: t.product_summary || "SumUp POS sale",
            qty: 1,
            unit_price_cents: totalCents,
            notes: null as string | null,
          }];

      await supabaseAdmin.from("order_items").insert(lines);
      imported++;
    }

    return { imported, skipped, error: null };
  });