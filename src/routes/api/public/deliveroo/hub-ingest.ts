import { createFileRoute } from "@tanstack/react-router";
import { extractHubOrders } from "@/lib/deliveroo-hub";
import { bridgeSecretMatches, ingestDeliverooOrder, readBridgeSecret } from "@/lib/deliveroo-ingest.server";

/**
 * Ingest orders observed in Deliveroo Restaurant Hub.
 *
 * The Deliveroo tablet has a sealed built-in printer, so nothing can be
 * intercepted there. Instead a watcher in the shop stays signed into Hub and
 * forwards Hub's own order payloads here verbatim; all interpretation happens
 * server-side so the shop machine never needs updating. The tablet continues
 * to accept and print exactly as before — this only mirrors the order onto
 * the Cafe1 KDS.
 *
 * Public prefix, so the handler authenticates the caller itself and returns
 * no customer data.
 */
export const Route = createFileRoute("/api/public/deliveroo/hub-ingest")({
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
        if (!raw.trim()) return Response.json({ error: "Empty payload" }, { status: 400 });
        if (raw.length > 400_000) return Response.json({ error: "Payload too large" }, { status: 413 });

        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const orders = extractHubOrders(payload);
        if (!orders.length) {
          // Not an error: Hub sends plenty of unrelated payloads.
          return Response.json({ ok: true, created: 0, duplicates: 0, recognised: 0 });
        }

        let created = 0;
        let duplicates = 0;
        const references: string[] = [];
        for (const order of orders) {
          try {
            const result = await ingestDeliverooOrder(order, "hub");
            if (result.duplicate) duplicates += 1;
            else {
              created += 1;
              references.push(result.reference);
            }
          } catch (err) {
            console.error("Hub ingest failed for", order.reference, (err as Error).message);
          }
        }

        return Response.json({ ok: true, created, duplicates, recognised: orders.length, references });
      },
    },
  },
});
