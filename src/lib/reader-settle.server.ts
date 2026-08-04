// Shared settlement for SumUp Solo (Cloud API) reader payments.
// Used by both the till's polling check and the real-time reader webhook so a
// transaction can only ever be settled once, with the amount re-verified
// against SumUp itself.
import { getReaderTransaction } from "./sumup-readers.server";

export type ReaderSettlement = {
  status: string;
  paid: boolean;
  failed: boolean;
  transaction_id: string | null;
  payment_attempt_id: string;
};

type AttemptRow = {
  id: string;
  status: string;
  amount_cents: number;
  client_transaction_id: string | null;
  provider_transaction_id: string | null;
};

/**
 * Re-verifies a reader transaction with SumUp and moves the payment attempt to
 * its final state. Safe to call repeatedly (webhook + poll can race).
 */
export async function settleReaderAttempt(attempt: AttemptRow): Promise<ReaderSettlement> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (attempt.status === "paid" || attempt.status === "used") {
    return {
      status: attempt.status.toUpperCase(),
      paid: true,
      failed: false,
      transaction_id: attempt.provider_transaction_id,
      payment_attempt_id: attempt.id,
    };
  }
  if (!attempt.client_transaction_id) throw new Error("Reader transaction has not started");

  const txn = await getReaderTransaction(attempt.client_transaction_id);
  const status = (txn?.status ?? "PENDING").toUpperCase();
  const paid = status === "SUCCESSFUL" || status === "PAID";
  const failed = status === "FAILED" || status === "CANCELLED" || status === "CANCELED";

  if (paid) {
    const amountCents = Math.round(Number(txn?.amount ?? 0) * 100);
    const currency = (txn?.currency ?? "GBP").toUpperCase();
    if (amountCents !== attempt.amount_cents || currency !== "GBP") {
      await supabaseAdmin
        .from("payment_attempts")
        .update({ status: "failed", failure_reason: "Provider amount or currency mismatch" })
        .eq("id", attempt.id);
      throw new Error("Reader payment amount did not match the order");
    }
    const transactionId = txn?.id ?? txn?.transaction_code;
    if (!transactionId) throw new Error("SumUp transaction ID is missing");
    await supabaseAdmin
      .from("payment_attempts")
      .update({ status: "paid", provider_transaction_id: transactionId })
      .eq("id", attempt.id)
      .eq("status", "pending");
  } else if (failed) {
    await supabaseAdmin
      .from("payment_attempts")
      .update({ status: "failed", failure_reason: `Reader returned ${status}` })
      .eq("id", attempt.id);
  }

  return {
    status,
    paid,
    failed,
    transaction_id: txn?.id ?? txn?.transaction_code ?? null,
    payment_attempt_id: attempt.id,
  };
}