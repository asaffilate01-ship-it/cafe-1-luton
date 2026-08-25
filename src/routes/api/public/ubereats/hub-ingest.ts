import { createFileRoute } from "@tanstack/react-router";

import { recordIntegrationHeartbeat } from "@/lib/deliveroo-ingest.server";
import {
  cancelPartnerOrder,
  ingestPartnerOrder,
  partnerSecretMatches,
  readPartnerSecret,
  uberEatsIngestEnabled,
} from "@/lib/partner-ingest.server";
import { extractUberEatsOrders, uberEatsOrderAction } from "@/lib/ubereats-hub";

/** Authenticated bridge from Uber Eats Manager on the Crown Court café PC. */
export const Route = createFileRoute("/api/public/ubereats/hub-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!uberEatsIngestEnabled("hub_watcher")) {
          return Response.json({ error: "Uber Eats watcher is disabled" }, { status: 503 });
        }
        if (!process.env["UBEREATS_BRIDGE_SECRET"]) {
          return Response.json({ error: "Bridge not configured" }, { status: 503 });
        }
        if (!partnerSecretMatches("uber_eats", readPartnerSecret(request))) {
          return new Response("Unauthorized", { status: 401 });
        }

        const raw = await request.text();
        if (!raw.trim()) return Response.json({ error: "Empty payload" }, { status: 400 });
        if (raw.length > 400_000) {
          return Response.json({ error: "Payload too large" }, { status: 413 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const beat = payload as {
          heartbeat?: boolean;
          signedOut?: boolean;
          payloadsSeen?: number;
        };
        const detail =
          beat && beat.heartbeat
            ? beat.signedOut
              ? "Signed out of Uber Eats Manager — orders are NOT arriving"
              : `Uber Eats watcher connected · ${beat.payloadsSeen ?? 0} payloads seen`
            : "Uber Eats watcher connected";
        await recordIntegrationHeartbeat("uber_eats_hub", detail);

        const orders = extractUberEatsOrders(payload);
        if (!orders.length) {
          return Response.json({ ok: true, created: 0, duplicates: 0, recognised: 0 });
        }

        let created = 0;
        let duplicates = 0;
        let cancelled = 0;
        let awaitingAcceptance = 0;
        const references: string[] = [];
        for (const order of orders) {
          try {
            const action = uberEatsOrderAction(order.status);
            if (action === "cancel") {
              await cancelPartnerOrder("uber_eats", order.reference);
              cancelled += 1;
              continue;
            }
            if (action === "wait") {
              awaitingAcceptance += 1;
              continue;
            }
            const result = await ingestPartnerOrder("uber_eats", {
              reference: order.reference,
              customerName: order.customerName,
              type: order.type,
              totalCents: order.totalCents,
              notes: order.notes,
              items: order.items,
            });
            if (result.duplicate) duplicates += 1;
            else {
              created += 1;
              references.push(result.reference);
            }
          } catch (error) {
            console.error("Uber Eats watcher ingest failed", (error as Error).message);
          }
        }

        return Response.json({
          ok: true,
          created,
          duplicates,
          cancelled,
          awaiting_acceptance: awaitingAcceptance,
          recognised: orders.length,
          references,
        });
      },
    },
  },
});
