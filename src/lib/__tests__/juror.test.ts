import { describe, expect, it } from "vitest";
import { addWorkingDays, isCourtDeliveryAddress, jurorFoodDiscount } from "@/lib/juror";

describe("juror rules", () => {
  it("matches only approved court delivery addresses", () => {
    expect(isCourtDeliveryAddress("St Albans Crown Court, Bricket Road", "AL1 3JW")).toBe(true);
    expect(isCourtDeliveryAddress("1 High Street", "AL1 1AA")).toBe(false);
  });

  it("caps the discount at the remaining payable food", () => {
    expect(jurorFoodDiscount(75, 500)).toBe(8);
    expect(jurorFoodDiscount(1000, 500)).toBe(50);
  });

  it("skips weekends when calculating service dates", () => {
    expect(addWorkingDays(new Date("2026-07-31T12:00:00Z"), 2).toISOString().slice(0, 10)).toBe(
      "2026-08-03",
    );
  });
});
