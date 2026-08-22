/** Any unpaid order that is not a tab/account order is abandoned after 10 minutes. */
export const WEB_UNPAID_TTL_MS = 10 * 60 * 1000;
export const COUNTER_UNPAID_TTL_MS = 10 * 60 * 1000;

const TERMINAL_UNPAID_STATUSES = new Set(["FAILED", "CANCELLED", "CANCELED", "EXPIRED"]);

export type CleanupCandidate = {
  source: string;
  created_at: string;
  account_id?: string | null;
  payment_method?: string | null;
};

export type CleanupCheckoutIdentity = {
  checkoutId: string;
  checkoutReference: string | null;
  totalCents: number;
};

export type CleanupCheckoutSnapshot = {
  id: string;
  checkout_reference: string;
  status: string;
  amount: number | string;
  currency: string;
  transaction_id?: string | null;
};

export type SumUpCleanupDecision = "recover_paid" | "abandon" | "hold";

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
 * A SumUp reservation is released only when the provider confirms a terminal
 * unpaid state. Pending, processing, unknown and malformed responses stay on
 * hold regardless of age; this prevents a late payment becoming detached from
 * an order whose voucher, promotion or loyalty reservation was already freed.
 */
export function decideSumUpCleanup(
  order: CleanupCheckoutIdentity,
  checkout: CleanupCheckoutSnapshot,
): SumUpCleanupDecision {
  const status = checkout.status.trim().toUpperCase();

  if (status === "PAID") {
    const amountCents = Math.round(Number(checkout.amount) * 100);
    const exactMatch =
      checkout.id === order.checkoutId &&
      checkout.checkout_reference === order.checkoutReference &&
      checkout.currency.trim().toUpperCase() === "GBP" &&
      Number.isFinite(amountCents) &&
      amountCents === order.totalCents &&
      Boolean(checkout.transaction_id?.trim());

    return exactMatch ? "recover_paid" : "hold";
  }

  if (TERMINAL_UNPAID_STATUSES.has(status)) return "abandon";
  return "hold";
}
