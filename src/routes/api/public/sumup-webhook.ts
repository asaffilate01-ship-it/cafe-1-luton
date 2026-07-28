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

          let paid = false;
          let txId: string | undefined;
          if (checkoutId) {
            const c = await getSumUpCheckout(checkoutId);
            paid = c.status === "PAID";
            txId = c.transaction_id;
          }
          // Payment lands the order in "paid" (awaiting staff acceptance).
          // Staff accept from the Admin dashboard, which advances to "preparing".
          const patch = {
            payment_status: paid ? ("paid" as const) : ("failed" as const),
            // Auto-accept website orders straight into the kitchen
            status: paid ? ("preparing" as const) : ("pending_payment" as const),
            sumup_transaction_id: txId ?? null,
          };
          const q = supabaseAdmin.from("orders").update(patch);
          const { error } = reference
            ? await q.eq("sumup_reference", reference)
            : await q.eq("sumup_checkout_id", checkoutId!);
          if (error) console.error("[sumup-webhook] update", error);

          return Response.json({ ok: true });
        } catch (err) {
          console.error("[sumup-webhook]", err);
          return new Response("err", { status: 500 });
        }
      },
    },
  },
});