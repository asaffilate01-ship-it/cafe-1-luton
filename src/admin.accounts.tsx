import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sumup-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            id?: string;
            checkout_reference?: string;
          };
          const checkoutId = body.id;
          const reference = body.checkout_reference;
          if (!checkoutId && !reference) return new Response("bad", { status: 400 });

          const { getSumUpCheckout } = await import("@/lib/sumup.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Never trust the webhook body: always re-verify against SumUp.
          // Resolve the checkout id from our own record when it isn't supplied.
          const { data: order } = checkoutId
            ? await supabaseAdmin
                .from("orders")
                .select("id, total_cents, sumup_checkout_id, sumup_reference, payment_status")
                .eq("sumup_checkout_id", checkoutId)
                .maybeSingle()
            : await supabaseAdmin
                .from("orders")
                .select("id, total_cents, sumup_checkout_id, sumup_reference, payment_status")
                .eq("sumup_reference", reference ?? "")
                .maybeSingle();
          if (!order?.sumup_checkout_id) return new Response("unknown checkout", { status: 404 });
          const resolvedId = order.sumup_checkout_id;

          const c = await getSumUpCheckout(resolvedId);
          const paid = c.status === "PAID";
          const txId = c.transaction_id;
          // Only act on a confirmed PAID result; ignore anything else so a
          // spoofed call can never downgrade or cancel a real order.
          if (!paid) return Response.json({ ok: true, ignored: true });
          if (
            c.id !== order.sumup_checkout_id ||
            c.checkout_reference !== order.sumup_reference ||
            c.currency !== "GBP" ||
            Math.round(Number(c.amount) * 100) !== order.total_cents ||
            !txId
          ) {
            console.error("[sumup-webhook] checkout mismatch", order.id);
            return new Response("checkout mismatch", { status: 409 });
          }
          // Payment lands the order in "paid" (awaiting staff acceptance).
          // Staff accept from the Admin dashboard, which advances to "preparing".
          const patch = {
            payment_status: "paid" as const,
            // Auto-accept website orders straight into the kitchen
            status: "preparing" as const,
            sumup_transaction_id: txId ?? null,
          };
          const { error } = await supabaseAdmin
            .from("orders")
            .update(patch)
            .eq("id", order.id)
            .eq("payment_status", "pending");
          if (error) console.error("[sumup-webhook] update", error);

          // Loyalty points/stamps are only granted on a confirmed payment.
          const { awardLoyaltyForOrder } = await import("@/lib/loyalty.server");
          await awardLoyaltyForOrder(order.id);

          return Response.json({ ok: true });
        } catch (err) {
          console.error("[sumup-webhook]", err);
          return new Response("err", { status: 500 });
        }
      },
    },
  },
});
