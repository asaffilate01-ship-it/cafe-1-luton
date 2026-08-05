import { createFileRoute } from "@tanstack/react-router";
import { parseDeliverooReceipt } from "@/lib/deliveroo-print";
import { bridgeSecretMatches, ingestDeliverooOrder, readBridgeSecret } from "@/lib/deliveroo-ingest.server";

/**
 * Ingest an order receipt captured off a Deliveroo tablet's print stream.
 *
 * Only usable where the tablet can be pointed at an external network printer.
 * Tablets with a sealed built-in printer use the Hub watcher instead
 * (see api/public/deliveroo/hub-ingest).
 *
 * Public prefix, so the handler authenticates the caller itself.
 */
export const Route = createFileRoute("/api/public/deliveroo/print-bridge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env["DELIVEROO_BRIDGE_SECRET"]) {
          return Response.json({ error: "Bridge not configured" }, { status: 503 });
        }
        if (!bridgeSecretMatches(readBridgeSecret(request))) {
          return new Response("Unauthorized", { status: 401 });
        }

        const raw = await request.text();
        if (!raw.trim()) return Response.json({ error: "Empty receipt" }, { status: 400 });
        if (raw.length > 20_000) return Response.json({ error: "Receipt too large" }, { status: 413 });

        const parsed = parseDeliverooReceipt(raw);
        const reference = parsed.reference ?? `P${Date.now().toString(36).toUpperCase()}`;

        try {
          const result = await ingestDeliverooOrder(
            {
              reference,
              customerName: parsed.customerName,
              type: parsed.type,
              totalCents: parsed.totalCents,
              notes: parsed.notes,
              items: parsed.items,
            },
            "print",
          );
          return Response.json({
            ok: true,
            order_id: result.order_id,
            reference: result.reference,
            duplicate: result.duplicate,
            items: parsed.items.length,
            degraded: parsed.degraded,
          });
        } catch (err) {
          console.error("Deliveroo print bridge failed:", (err as Error).message);
          return Response.json({ error: "Could not create the ticket" }, { status: 500 });
        }
      },
    },
  },
});
