import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Confirms a card payment straight with SumUp, independent of the webhook.
 * Safe to call publicly: it only reads the checkout attached to that order
 * and can never mark an order paid unless SumUp says PAID.
 */
export const confirmPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, sumup_checkout_id")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");
    if (order.payment_status === "paid" || order.payment_status === "on_account") {
      return { paid: true, status: order.payment_status };
    }
    if (!order.sumup_checkout_id) return { paid: false, status: order.payment_status };

    const { getSumUpCheckout } = await import("./sumup.server");
    const co = await getSumUpCheckout(order.sumup_checkout_id);
    if (co.status !== "PAID") return { paid: false, status: order.payment_status };

    await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid" as const,
        status: "preparing" as const,
        sumup_transaction_id: co.transaction_id ?? null,
      })
      .eq("id", order.id);
    const { awardLoyaltyForOrder } = await import("./loyalty.server");
    await awardLoyaltyForOrder(order.id);
    return { paid: true, status: "preparing" as const };
  });

/**
 * Refunds an order through SumUp (full or partial) and marks it refunded.
 * Staff/admin only.
 */
export const refundOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        amount_cents: z.number().int().positive().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
    ]);
    if (!isAdmin && !isStaff) throw new Error("Forbidden");

    const { data: order, error } = await context.supabase
      .from("orders")
      .select("id, total_cents, payment_status, payment_method, sumup_transaction_id")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");
    if (order.payment_status === "refunded") throw new Error("Already refunded");

    const amount = data.amount_cents ?? order.total_cents;
    if (amount > order.total_cents) throw new Error("Refund exceeds order total");

    let note = "Marked refunded (no card transaction to reverse)";
    if (order.sumup_transaction_id) {
      const { refundSumUpTransaction } = await import("./sumup.server");
      await refundSumUpTransaction(
        order.sumup_transaction_id,
        amount < order.total_cents ? amount : undefined,
      );
      note = amount < order.total_cents ? "Partial card refund sent to SumUp" : "Full card refund sent to SumUp";
    }

    const { error: uErr } = await context.supabase
      .from("orders")
      .update({ payment_status: "refunded" as const, status: "refunded" as const })
      .eq("id", order.id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, amount_cents: amount, note };
  });