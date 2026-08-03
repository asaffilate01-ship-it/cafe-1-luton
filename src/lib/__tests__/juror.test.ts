import { describe, expect, it } from "vitest";
import {
  addWorkingDays,
  isCourtDeliveryAddress,
  jurorFoodDiscount,
  JUROR_DAILY_ALLOWANCE_CENTS,
  JUROR_EXTENDED_DAY_ALLOWANCE_CENTS,
} from "@/lib/juror";

describe("juror rules", () => {
  it("matches only approved court delivery addresses", () => {
    expect(isCourtDeliveryAddress("St Albans Crown Court, Bricket Road", "AL1 3JU")).toBe(true);
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

  it("uses the current standard and over-10-hour HMCTS food rates", () => {
    expect(JUROR_DAILY_ALLOWANCE_CENTS).toBe(571);
    expect(JUROR_EXTENDED_DAY_ALLOWANCE_CENTS).toBe(1217);
  });

  it("expires a standard service after ten inclusive working days", () => {
    expect(addWorkingDays(new Date("2026-08-03T12:00:00Z"), 10).toISOString().slice(0, 10)).toBe(
      "2026-08-14",
    );
  });
});
