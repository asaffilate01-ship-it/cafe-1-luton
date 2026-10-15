import { describe, expect, it } from "vitest";

import {
  COUNTER_UNPAID_TTL_MS,
  isPastCleanupThreshold,
  mayAutoReleaseUnpaidReservation,
  WEB_UNPAID_TTL_MS,
} from "../order-cleanup-policy";

const NOW = Date.parse("2026-08-08T12:00:00.000Z");

function createdAt(ageMs: number) {
  return new Date(NOW - ageMs).toISOString();
}


describe("unpaid order cleanup threshold", () => {
  it("uses separate web and counter grace periods", () => {
    expect(
      isPastCleanupThreshold(
        { source: "web", created_at: createdAt(WEB_UNPAID_TTL_MS - 1) },
        NOW,
      ),
    ).toBe(false);
    expect(
      isPastCleanupThreshold({ source: "web", created_at: createdAt(WEB_UNPAID_TTL_MS) }, NOW),
    ).toBe(true);
    expect(
      isPastCleanupThreshold(
        { source: "counter", created_at: createdAt(COUNTER_UNPAID_TTL_MS - 1) },
        NOW,
      ),
    ).toBe(false);
    expect(
      isPastCleanupThreshold(
        { source: "counter", created_at: createdAt(COUNTER_UNPAID_TTL_MS) },
        NOW,
      ),
    ).toBe(true);
  });

  it("never auto-abandons account orders or invalid timestamps", () => {
    expect(
      isPastCleanupThreshold(
        { source: "web", created_at: createdAt(WEB_UNPAID_TTL_MS), account_id: "account-1" },
        NOW,
      ),
    ).toBe(false);
    expect(
      isPastCleanupThreshold(
        { source: "web", created_at: createdAt(WEB_UNPAID_TTL_MS), payment_method: "on_account" },
        NOW,
      ),
    ).toBe(false);
    expect(isPastCleanupThreshold({ source: "web", created_at: "not-a-date" }, NOW)).toBe(false);
    expect(
      isPastCleanupThreshold(
        { source: "web", created_at: new Date(NOW + WEB_UNPAID_TTL_MS).toISOString() },
        NOW,
      ),
    ).toBe(false);
  });
});

describe("unverified provider reservation safety", () => {
  const cashCounter = { source: "counter", created_at: createdAt(WEB_UNPAID_TTL_MS), payment_method: "cash" };
  it("only permits orphaned, cash-only counter drafts to proceed to attempt verification", () => {
    expect(mayAutoReleaseUnpaidReservation(cashCounter)).toBe(true);
    expect(mayAutoReleaseUnpaidReservation({ ...cashCounter, account_id: "house-tab" })).toBe(false);
    expect(mayAutoReleaseUnpaidReservation({ ...cashCounter, sumup_checkout_id: "checkout-1" })).toBe(false);
    expect(mayAutoReleaseUnpaidReservation({ ...cashCounter, sumup_reference: "sale-1" })).toBe(false);
  });
  it("keeps asynchronous website, reader, SumUp POS and future Adyen payments on hold", () => {
    for (const source of ["web", "sumup_pos"]) {
      expect(mayAutoReleaseUnpaidReservation({ ...cashCounter, source })).toBe(false);
    }
    for (const method of ["card", "sumup", "reader", "adyen", "wallet", "online", "on_account"]) {
      expect(mayAutoReleaseUnpaidReservation({ ...cashCounter, payment_method: method })).toBe(false);
    }
    expect(mayAutoReleaseUnpaidReservation({ ...cashCounter, payment_method: null })).toBe(false);
  });
});
