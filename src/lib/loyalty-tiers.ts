/**
 * Points rewards. Customers earn 1 point per £1 spent; points are redeemed in
 * fixed tiers at checkout so the value of a point is always predictable.
 */
export type RewardTier = {
  points: number;
  value_cents: number;
  label: string;
};

export const REWARD_TIERS: RewardTier[] = [
  { points: 50, value_cents: 250, label: "£2.50 off" },
  { points: 100, value_cents: 600, label: "£6.00 off" },
  { points: 200, value_cents: 1300, label: "£13.00 off" },
];

export function tierForPoints(points: number): RewardTier | null {
  return REWARD_TIERS.find((t) => t.points === points) ?? null;
}

/** Tiers the customer can afford with their balance and this order value. */
export function affordableTiers(balance: number, payableCents: number): RewardTier[] {
  return REWARD_TIERS.filter((t) => balance >= t.points && payableCents > 0);
}

/** Cash value actually applied — never more than the amount still payable. */
export function rewardDiscountCents(points: number, payableCents: number): number {
  const tier = tierForPoints(points);
  if (!tier) return 0;
  return Math.max(0, Math.min(tier.value_cents, Math.max(0, payableCents)));
}
