/**
 * Loyalty rewards are only granted once an order has actually been paid.
 * Idempotent: the `loyalty_awarded` flag is flipped with a conditional
 * update, so concurrent callers (webhook + client confirm) can't double-award.
 */
export async function awardLoyaltyForOrder(orderId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: claimed } = await supabaseAdmin
    .from("orders")
    .update({ loyalty_awarded: true })
    .eq("id", orderId)
    .eq("loyalty_awarded", false)
    .select("customer_id, points_earned, loyalty_stamps_pending")
    .maybeSingle();

  if (!claimed?.customer_id) return false;

  const points = claimed.points_earned ?? 0;
  const stamps = claimed.loyalty_stamps_pending ?? 0;
  if (points <= 0 && stamps <= 0) return false;

  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("loyalty_points, lifetime_points, drink_stamps, free_drinks_available")
    .eq("id", claimed.customer_id)
    .maybeSingle();

  const stampsTotal = (prof?.drink_stamps ?? 0) + stamps;

  await supabaseAdmin
    .from("profiles")
    .update({
      loyalty_points: (prof?.loyalty_points ?? 0) + points,
      lifetime_points: (prof?.lifetime_points ?? 0) + points,
      drink_stamps: stampsTotal % 10,
      free_drinks_available: (prof?.free_drinks_available ?? 0) + Math.floor(stampsTotal / 10),
    })
    .eq("id", claimed.customer_id);

  return true;
}