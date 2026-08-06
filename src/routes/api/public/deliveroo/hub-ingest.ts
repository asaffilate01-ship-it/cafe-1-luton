import { createFileRoute } from "@tanstack/react-router";
import { extractHubOrders } from "@/lib/deliveroo-hub";
import {
  bridgeSecretMatches,
  ingestDeliverooOrder,
  readBridgeSecret,
  recordIntegrationHeartbeat,
} from "@/lib/deliveroo-ingest.server";

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

        // Every authenticated call proves the shop watcher is alive, even the
        // quiet ones that carry no orders. Heartbeats also report whether Hub
        // is still signed in, so a dead link is visible before an order is
        // missed rather than after.
        const beat = payload as { heartbeat?: boolean; signedOut?: boolean; payloadsSeen?: number };
        const detail =
          beat && beat.heartbeat
            ? beat.signedOut
              ? "Signed out of Restaurant Hub — orders are NOT arriving"
              : `Restaurant Hub watcher connected · ${beat.payloadsSeen ?? 0} Hub payloads seen`
            : "Restaurant Hub watcher connected";
        await recordIntegrationHeartbeat("deliveroo_hub", detail);

        const orders = extractHubOrders(payload);
        if (!orders.length) {
          if (!beat?.heartbeat) {
            // Helps trace a Hub payload shape we do not yet recognise.
            console.warn("Hub payload not recognised as orders:", raw.slice(0, 400));
          }
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
