// Real-time results for SumUp Solo (Cloud API) reader payments.
// SumUp POSTs here when a reader transaction reaches a final state. The body is
// never trusted: we only use it to locate our own payment attempt, then
// re-verify the transaction directly with SumUp before settling.
import { createFileRoute } from "@tanstack/react-router";

type ReaderEvent = {
  id?: string;
  event_type?: string;
  payload?: {
    client_transaction_id?: string;
    transaction_id?: string;
    foreign_transaction_id?: string;
    status?: string;
  };
  client_transaction_id?: string;
  foreign_transaction_id?: string;
};

export const Route = createFileRoute("/api/public/sumup-reader-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as ReaderEvent;
          const clientTransactionId =
            body.payload?.client_transaction_id ?? body.client_transaction_id ?? null;
          const reference =
            body.payload?.foreign_transaction_id ?? body.foreign_transaction_id ?? null;
          if (!clientTransactionId && !reference) {
            return new Response("missing transaction reference", { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const query = supabaseAdmin
            .from("payment_attempts")
            .select("id, status, amount_cents, client_transaction_id, provider_transaction_id");
          const { data: attempt } = clientTransactionId
            ? await query.eq("client_transaction_id", clientTransactionId).maybeSingle()
            : await query.eq("provider_reference", reference!).maybeSingle();

          if (!attempt) return new Response("unknown transaction", { status: 404 });

          const { settleReaderAttempt } = await import("@/lib/reader-settle.server");
          const result = await settleReaderAttempt(attempt);
          return Response.json({ ok: true, status: result.status, paid: result.paid });
        } catch (err) {
          console.error("[sumup-reader-webhook]", err);
          return new Response("err", { status: 500 });
        }
      },
    },
  },
});