/**
 * Reconciles stale payment orders without deleting financial records. Only
 * authoritatively unpaid/expired rows are marked abandoned and have their
 * reserved benefits released.
 */
import { isPastCleanupThreshold, WEB_UNPAID_TTL_MS } from "./order-cleanup-policy";

export async function purgeStaleUnpaidOrders(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - WEB_UNPAID_TTL_MS).toISOString();

  const { data: stale } = await supabaseAdmin
    .from("orders")
    .select(
      "id, source, created_at, total_cents, promo_code, voucher_holder_id, voucher_cents, customer_id, loyalty_free_drinks_used, account_id, payment_method",
    )
    .eq("status", "pending_payment")
    .eq("payment_status", "pending")
    .lt("created_at", cutoff)
    .limit(200);

  let abandoned = 0;
  for (const order of stale ?? []) {
    if (!isPastCleanupThreshold(order)) continue;

    // A reader response that is still uncertain must never release benefits or
    // abandon the order. The next scheduler run will reconcile it again.
    if (order.source === "counter") {
      const { data: activeAttempt } = await supabaseAdmin
        .from("payment_attempts")
        .select("id")
        .eq("order_id", order.id)
        .in("status", ["created", "pending", "paid"])
        .limit(1)
        .maybeSingle();
      if (activeAttempt) continue;
    }

    await supabaseAdmin.from("voucher_redemptions").delete().eq("order_id", order.id);
    if (order.voucher_holder_id && order.voucher_cents > 0) {
      const { data: holder } = await supabaseAdmin
        .from("voucher_holders")
        .select("code")
        .eq("id", order.voucher_holder_id)
        .maybeSingle();
      if (holder) {
        await supabaseAdmin.from("voucher_events").insert({
          holder_id: order.voucher_holder_id,
          code: holder.code,
          event: "release",
          amount_cents: order.voucher_cents,
          order_id: order.id,
          detail: "Payment abandoned after provider reconciliation",
        });
      }
    }

    if (order.promo_code) {
      const { data: promo } = await supabaseAdmin
        .from("promo_codes")
        .select("id, uses")
        .ilike("code", order.promo_code)
        .maybeSingle();
      if (promo && promo.uses > 0) {
        await supabaseAdmin
          .from("promo_codes")
          .update({ uses: promo.uses - 1 })
          .eq("id", promo.id)
          .eq("uses", promo.uses);
      }
    }

    if (order.customer_id && order.loyalty_free_drinks_used > 0) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("free_drinks_available, free_drinks_redeemed")
        .eq("id", order.customer_id)
        .maybeSingle();
      if (profile) {
        await supabaseAdmin
          .from("profiles")
          .update({
            free_drinks_available: profile.free_drinks_available + order.loyalty_free_drinks_used,
            free_drinks_redeemed: Math.max(
              0,
              profile.free_drinks_redeemed - order.loyalty_free_drinks_used,
            ),
          })
          .eq("id", order.customer_id);
      }
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "failed",
        status: "cancelled",
        abandoned_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("payment_status", "pending");
    if (!error) abandoned++;
  }
  return abandoned;
}
