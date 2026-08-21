import { jurorFoodDiscount } from "@/lib/juror";

export function calculateCounterDue(input: {
  subtotalCents: number;
  foodSubtotalCents: number;
  voucherRemainingCents?: number;
  /** Scheme members only: the 10% food discount needs an opted-in juror. */
  optedIn?: boolean;
  /** Ad-hoc discount keyed in by the operator, applied last. */
  manualDiscountType?: "percent" | "fixed_amount" | null;
  manualDiscountValue?: number;
}) {
  const subtotalCents = Math.max(0, Math.trunc(input.subtotalCents));
  const foodSubtotalCents = Math.min(
    subtotalCents,
    Math.max(0, Math.trunc(input.foodSubtotalCents)),
  );
  const voucherCents = Math.min(
    subtotalCents,
    Math.max(0, Math.trunc(input.voucherRemainingCents ?? 0)),
  );
  const discountCents =
    input.voucherRemainingCents === undefined || input.optedIn === false
      ? 0
      : jurorFoodDiscount(subtotalCents - voucherCents, foodSubtotalCents);
  const beforeManual = Math.max(0, subtotalCents - voucherCents - discountCents);
  const rawManual =
    input.manualDiscountType && (input.manualDiscountValue ?? 0) > 0
      ? input.manualDiscountType === "percent"
        ? Math.round((beforeManual * Math.min(100, input.manualDiscountValue ?? 0)) / 100)
        : Math.trunc(input.manualDiscountValue ?? 0)
      : 0;
  const manualDiscountCents = Math.min(Math.max(0, rawManual), beforeManual);
  return {
    subtotalCents,
    voucherCents,
    discountCents,
    manualDiscountCents,
    dueCents: beforeManual - manualDiscountCents,
  };
}
