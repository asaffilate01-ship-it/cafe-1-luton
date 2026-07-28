import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
    return { paid: true, status: "preparing" as const };
  });
