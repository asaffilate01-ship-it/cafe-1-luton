import { describe, expect, it } from "vitest";
import { calculateCounterDue } from "@/lib/counter-pricing";

describe("calculateCounterDue", () => {
  it("applies the voucher before the juror food discount", () => {
    expect(
      calculateCounterDue({
        subtotalCents: 1000,
        foodSubtotalCents: 800,
        voucherRemainingCents: 571,
      }),
    ).toEqual({
      subtotalCents: 1000,
      voucherCents: 571,
      discountCents: 43,
      dueCents: 386,
    });
  });

  it("does not discount drinks or allow negative values", () => {
    expect(
      calculateCounterDue({
        subtotalCents: 250,
        foodSubtotalCents: 0,
        voucherRemainingCents: -10,
      }).dueCents,
    ).toBe(250);
  });

  it("does not apply the juror discount without a voucher", () => {
    expect(calculateCounterDue({ subtotalCents: 800, foodSubtotalCents: 800 })).toMatchObject({
      discountCents: 0,
      dueCents: 800,
    });
  });
});
