/**
 * Website orders that are never paid are abandoned baskets — after 5 minutes
 * they are removed entirely so they can't clutter reports, the KDS or the
 * customer's history. Any court voucher held against them is released and any
 * promo-code use is handed back.
 */
const UNPAID_TTL_MS = 5 * 60 * 1000;

export async function purgeStaleUnpaidOrders(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - UNPAID_TTL_MS).toISOString();

  const { data: stale } = await supabaseAdmin
    .from("orders")
    .select("id, promo_code")
    .eq("status", "pending_payment")
    .eq("payment_status", "pending")
    .lt("created_at", cutoff)
    .limit(200);

  const ids = (stale ?? []).map((o) => o.id);
  if (!ids.length) return 0;

  // Release held voucher allowance and hand promo uses back.
  await supabaseAdmin.from("voucher_redemptions").delete().in("order_id", ids);
  for (const o of stale ?? []) {
    if (!o.promo_code) continue;
    const { data: promo } = await supabaseAdmin
      .from("promo_codes")
      .select("id, uses")
      .ilike("code", o.promo_code)
      .maybeSingle();
    if (promo && promo.uses > 0) {
      await supabaseAdmin.from("promo_codes").update({ uses: promo.uses - 1 }).eq("id", promo.id);
    }
  }

  await supabaseAdmin.from("order_items").delete().in("order_id", ids);
  const { error } = await supabaseAdmin.from("orders").delete().in("id", ids);
  if (error) {
    console.error("[order-cleanup] delete failed", error);
    return 0;
  }
  return ids.length;
}