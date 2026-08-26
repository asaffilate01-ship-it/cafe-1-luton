import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireStaffOrderAccess } from "./staff-site-access.server";

/**
 * Authorised till refund ledger with partial-refund accounting and idempotency.
 * Card refunds are settled on the EVO terminal by staff; this records the
 * ledger entry so the till, reports and order history stay in balance.
 */
export const refundOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        amount_cents: z.number().int().positive().optional(),
        reason: z.string().min(5).max(300),
        idempotency_key: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaffOrderAccess(context, data.order_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prior } = await supabaseAdmin
      .from("order_refunds")
      .select("id, amount_cents, status")
      .eq("idempotency_key", data.idempotency_key)
      .maybeSingle();
    if (prior?.status === "succeeded") {
      return { ok: true, amount_cents: prior.amount_cents, note: "Refund already processed" };
    }
    if (prior?.status === "pending") throw new Error("That refund is already processing");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, total_cents, refunded_cents, payment_status, payment_method, source")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");
    if (!["paid", "refunded", "on_account"].includes(order.payment_status)) {
      throw new Error("Only a settled order can be refunded");
    }
    const remaining = order.total_cents - order.refunded_cents;
    if (remaining <= 0) throw new Error("Order is already fully refunded");
    const amount = data.amount_cents ?? remaining;
    if (amount > remaining) throw new Error("Refund exceeds the remaining paid amount");

    const [{ data: tenders }, { data: previousRefunds }] = await Promise.all([
      supabaseAdmin.from("order_payments").select("method, amount_cents").eq("order_id", order.id),
      supabaseAdmin
        .from("order_refunds")
        .select("card_amount_cents, cash_amount_cents")
        .eq("order_id", order.id)
        .eq("status", "succeeded"),
    ]);

    let paidCard = (tenders ?? [])
      .filter((payment) => payment.method === "card")
      .reduce((sum, payment) => sum + payment.amount_cents, 0);
    let paidCash = (tenders ?? [])
      .filter((payment) => payment.method === "cash")
      .reduce((sum, payment) => sum + payment.amount_cents, 0);
    if (paidCard === 0 && paidCash === 0) {
      if (order.payment_method === "cash") paidCash = order.total_cents;
      else if (order.payment_method === "card") paidCard = order.total_cents;
    }
    const refundedCard = (previousRefunds ?? []).reduce(
      (sum, refund) => sum + refund.card_amount_cents,
      0,
    );
    const refundedCash = (previousRefunds ?? []).reduce(
      (sum, refund) => sum + refund.cash_amount_cents,
      0,
    );
    const { allocateRefund } = await import("./refund-allocation");
    const { cardCents: cardAmount, cashCents: cashAmount } = allocateRefund({
      amountCents: amount,
      paidCardCents: paidCard,
      paidCashCents: paidCash,
      refundedCardCents: refundedCard,
      refundedCashCents: refundedCash,
    });

    const { data: refundRow, error: reserveError } = await supabaseAdmin.rpc(
      "reserve_order_refund",
      {
        _order_id: order.id,
        _idempotency_key: data.idempotency_key,
        _amount_cents: amount,
        _card_amount_cents: cardAmount,
        _cash_amount_cents: cashAmount,
        _reason: data.reason,
        _requested_by: context.userId,
        _provider: null as unknown as string,
        _provider_transaction_id: null as unknown as string,
      },
    );
    if (reserveError) throw new Error(reserveError.message);
    if (!refundRow) throw new Error("Could not reserve that refund");
    if (refundRow.status === "failed") {
      throw new Error("That refund attempt failed previously; start a new refund");
    }

    const note =
      cardAmount > 0 && cashAmount > 0
        ? `Refund recorded — return ${cardAmount}p on the EVO terminal and ${cashAmount}p in cash`
        : cardAmount > 0
          ? "Refund recorded — complete the card refund on the EVO terminal"
          : "Cash refund posted to the till ledger";

    try {
      const { error: completeError } = await supabaseAdmin.rpc("complete_order_refund", {
        _refund_id: refundRow.id,
      });
      if (completeError) throw new Error(completeError.message);
      return { ok: true, amount_cents: amount, note };
    } catch (refundError) {
      await supabaseAdmin
        .from("order_refunds")
        .update({
          status: "failed",
          failure_reason:
            refundError instanceof Error ? refundError.message.slice(0, 500) : "Refund failed",
        })
        .eq("id", refundRow.id);
      throw refundError;
    }
  });
