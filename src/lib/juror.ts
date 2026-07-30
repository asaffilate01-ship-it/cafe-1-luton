/**
 * HMCTS Juror Voucher Scheme — shared rules.
 *
 * • Every juror is issued an anonymous voucher code at induction.
 * • Codes carry a daily allowance on court sitting days only; unused value
 *   expires at the end of the day and never carries forward.
 * • Cafe 1 only ever claims the value actually redeemed.
 * • Scheme members get 10% off food (drinks excluded) on anything payable
 *   above the daily allowance — the voucher is always applied first.
 */
/** localStorage key holding the juror's anonymous code on their device. */
export const JUROR_CODE_KEY = "cafe1-juror-code";
export const JUROR_DAILY_ALLOWANCE_CENTS = 571;
export const JUROR_FOOD_DISCOUNT_PERCENT = 10;
/** Standard jury service length used when issuing codes. */
export const JUROR_DEFAULT_SERVICE_DAYS = 10;

/** 10% of the food value, capped at what is still payable after the voucher. */
export function jurorFoodDiscount(payableAfterVoucher: number, foodSubtotalCents: number): number {
  if (payableAfterVoucher <= 0 || foodSubtotalCents <= 0) return 0;
  return Math.round((Math.min(foodSubtotalCents, payableAfterVoucher) * JUROR_FOOD_DISCOUNT_PERCENT) / 100);
}

/** Adds N working days (Mon–Fri) to a date — bank holidays are handled server-side. */
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days - 1;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const JUROR_STATUS_LABEL: Record<string, string> = {
  ok: "Active",
  inactive: "Deactivated",
  not_started: "Not started",
  expired: "Expired",
  non_sitting_day: "Non-sitting day",
};
