/**
 * Awards rewards only after authoritative payment confirmation. The database
 * locks both the order and profile, making webhook/client/scheduler races safe.
 */
export async function awardLoyaltyForOrder(orderId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("award_loyalty_for_order", {
    _order_id: orderId,
  });
  if (error) {
    console.error("[loyalty] atomic award failed", error);
    return false;
  }
  return Boolean(data);
}
