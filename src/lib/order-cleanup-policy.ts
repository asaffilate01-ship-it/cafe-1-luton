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

/**
 * An order linked to a remote card checkout must not be released merely
 * because the local row is old. Without provider-side verification this is a
 * reconciliation HOLD; a delayed charge may still settle after the timeout.
 */
export function mayAutoReleaseUnpaidReservation(candidate: CleanupCandidate & {
  sumup_checkout_id?: string | null;
  sumup_reference?: string | null;
}): boolean {
  if (candidate.account_id || candidate.payment_method === "on_account") return false;
  if (candidate.sumup_checkout_id || candidate.sumup_reference) return false;
  if (candidate.source === "web" || candidate.source === "sumup_pos") return false;
  if (candidate.payment_method &&
    /(?:card|sumup|wallet|reader|adyen|online)/i.test(candidate.payment_method)) return false;
  // POS cash-only abandoned drafts may be cleared after a verified absence of
  // provider attempts. This helper is only one of several cleanup gates.
  return candidate.source === "counter" && candidate.payment_method === "cash";
}
