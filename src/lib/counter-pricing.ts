import { jurorFoodDiscount } from "@/lib/juror";

export function calculateCounterDue(input: {
  subtotalCents: number;
  foodSubtotalCents: number;
  voucherRemainingCents?: number;
  /** Scheme members only: the 10% food discount needs an opted-in juror. */
  optedIn?: boolean;
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
  return {
    subtotalCents,
    voucherCents,
    discountCents,
    dueCents: Math.max(0, subtotalCents - voucherCents - discountCents),
  };
}
