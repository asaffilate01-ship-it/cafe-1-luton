export function allocateRefund(input: {
  amountCents: number;
  paidCardCents: number;
  paidCashCents: number;
  refundedCardCents: number;
  refundedCashCents: number;
}) {
  const cardCents = Math.min(
    input.amountCents,
    Math.max(0, input.paidCardCents - input.refundedCardCents),
  );
  const cashCents = Math.min(
    input.amountCents - cardCents,
    Math.max(0, input.paidCashCents - input.refundedCashCents),
  );
  return {
    cardCents,
    cashCents,
    unallocatedCents: input.amountCents - cardCents - cashCents,
  };
}
