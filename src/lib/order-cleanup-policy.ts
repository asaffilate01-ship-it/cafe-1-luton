/** Any unpaid order that is not a tab/account order is abandoned after 10 minutes. */
export const WEB_UNPAID_TTL_MS = 10 * 60 * 1000;
export const COUNTER_UNPAID_TTL_MS = 10 * 60 * 1000;

export type CleanupCandidate = {
  source: string;
  created_at: string;
  account_id?: string | null;
  payment_method?: string | null;
};

/**
 * Account orders are settled outside the immediate checkout flow. Every other
 * order must pass its channel-specific age threshold before reconciliation.
 * Invalid timestamps fail closed so corrupt data cannot release reservations.
 */
export function isPastCleanupThreshold(candidate: CleanupCandidate, nowMs = Date.now()): boolean {
  if (candidate.account_id || candidate.payment_method === "on_account") return false;

  const createdAt = Date.parse(candidate.created_at);
  if (!Number.isFinite(createdAt) || createdAt > nowMs) return false;

  const ttlMs = candidate.source === "web" ? WEB_UNPAID_TTL_MS : COUNTER_UNPAID_TTL_MS;
  return nowMs - createdAt >= ttlMs;
}
