import { describe, expect, it } from "vitest";
import { allocateRefund } from "@/lib/refund-allocation";

describe("refund tender allocation", () => {
  it("refunds the card portion first and cash only for the remainder", () => {
    expect(
      allocateRefund({
        amountCents: 800,
        paidCardCents: 500,
        paidCashCents: 500,
        refundedCardCents: 0,
        refundedCashCents: 0,
      }),
    ).toEqual({ cardCents: 500, cashCents: 300, unallocatedCents: 0 });
  });

  it("does not refund a tender twice", () => {
    expect(
      allocateRefund({
        amountCents: 400,
        paidCardCents: 500,
        paidCashCents: 500,
        refundedCardCents: 500,
        refundedCashCents: 100,
      }),
    ).toEqual({ cardCents: 0, cashCents: 400, unallocatedCents: 0 });
  });

  it("leaves account-credit refunds unallocated to card or cash", () => {
    expect(
      allocateRefund({
        amountCents: 250,
        paidCardCents: 0,
        paidCashCents: 0,
        refundedCardCents: 0,
        refundedCashCents: 0,
      }).unallocatedCents,
    ).toBe(250);
  });
});
