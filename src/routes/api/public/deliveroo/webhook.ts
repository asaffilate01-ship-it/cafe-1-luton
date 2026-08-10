import { createFileRoute } from "@tanstack/react-router";

import {
  deliverooLineCents,
  deliverooRef,
  deliverooWasAccepted,
  extractDeliverooEnvelope,
  latestDeliverooStatus,
  mapDeliverooType,
  verifyDeliverooSignature,
  type DeliverooOrderPayload,
} from "@/lib/deliveroo.server";
import {
  cancelDeliverooOrder,
  ingestDeliverooOrder,
  recordIntegrationHeartbeat,
  type IngestOrder,
} from "@/lib/deliveroo-ingest.server";
import { pushDeliverooSyncStatus } from "@/lib/deliveroo-sync.server";

const MAX_WEBHOOK_BYTES = 1_000_000;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, max);
}

function safeIso(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function asIngestOrder(payload: DeliverooOrderPayload, reference: string): IngestOrder {
  const items = (payload.items ?? []).slice(0, 100).map((item) => {
    const modifiers = (item.modifiers ?? [])
      .map((modifier) => cleanText(modifier.name, 80))
      .filter((value): value is string => Boolean(value));
    return {
      name: cleanText(item.name ?? item.operational_name, 120) ?? "Deliveroo item",
      qty: Math.min(50, Math.max(1, Math.round(Number(item.quantity ?? 1)) || 1)),
      unitPriceCents: deliverooLineCents(item),
      notes: modifiers.length ? modifiers.join(", ").slice(0, 300) : null,
    };
  });
  const computedTotal = items.reduce((sum, item) => sum + (item.unitPriceCents ?? 0) * item.qty, 0);
  const reportedTotal =
    payload.partner_order_total?.fractional ??
    payload.total_price?.fractional ??
    payload.subtotal?.fractional;
  const totalCents =
    typeof reportedTotal === "number" && Number.isFinite(reportedTotal)
      ? Math.max(0, Math.round(reportedTotal))
      : computedTotal;
  const customerName =
    cleanText(payload.customer?.name, 60) ??
    cleanText(
      [payload.customer?.first_name, payload.customer?.last_name].filter(Boolean).join(" "),
      60,
    );
  const delivery = payload.delivery;
  const noteParts = [
    payload.display_id != null ? `Deliveroo #${String(payload.display_id).slice(0, 30)}` : null,
    cleanText(payload.order_notes ?? payload.note_to_restaurant, 400),
    cleanText(payload.cutlery_notes, 120),
    cleanText(delivery?.delivery_notes ?? delivery?.notes, 300),
  ].filter((value): value is string => Boolean(value));
  const scheduledFor = payload.asap === false ? safeIso(payload.prepare_for) : null;

  return {
    reference,
    alternateReferences: [payload.order_number, payload.display_id]
      .filter((value): value is string | number => value !== null && value !== undefined)
      .map(String),
    customerName,
    customerPhone: cleanText(payload.customer?.contact_number ?? delivery?.contact_number, 40),
    type: mapDeliverooType(payload.fulfillment_type ?? payload.order_type),
    totalCents,
    notes: noteParts.length ? noteParts.join(" · ").slice(0, 700) : null,
    scheduledFor,
    address: {
      line1: cleanText(delivery?.address?.line_1 ?? delivery?.line1, 120),
      line2: cleanText(delivery?.address?.line_2 ?? delivery?.line2, 120),
      city: cleanText(delivery?.address?.city ?? delivery?.city, 80),
      postcode: cleanText(delivery?.address?.post_code ?? delivery?.postcode, 20),
    },
    items: items.length
      ? items
      : [
          {
            name: "Deliveroo order — check device",
            qty: 1,
            unitPriceCents: totalCents,
            notes: null,
          },
        ],
  };
}

export const Route = createFileRoute("/api/public/deliveroo/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.DELIVEROO_WEBHOOK_SECRET;
        if (!secret) return new Response("Deliveroo webhook not configured", { status: 503 });

        const declaredLength = Number(request.headers.get("content-length") ?? "0");
        if (declaredLength > MAX_WEBHOOK_BYTES) {
          return new Response("Payload too large", { status: 413 });
        }
        const rawBytes = new Uint8Array(await request.arrayBuffer());
        if (rawBytes.byteLength > MAX_WEBHOOK_BYTES) {
          return new Response("Payload too large", { status: 413 });
        }

        const signature = request.headers.get("x-deliveroo-hmac-sha256");
        const sequence = request.headers.get("x-deliveroo-sequence-guid");
        if (!verifyDeliverooSignature(rawBytes, signature, secret, sequence, "either")) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(new TextDecoder().decode(rawBytes));
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const envelope = extractDeliverooEnvelope(parsed);
        if (!envelope) return new Response("Invalid order envelope", { status: 400 });

        const payloadType = request.headers.get("x-deliveroo-payload-type")?.toLowerCase();
        if (payloadType && payloadType !== `event/${envelope.event}`) {
          return new Response("Payload type does not match event", { status: 400 });
        }
        const webhookVersion = request.headers.get("x-deliveroo-webhook-version");
        if (webhookVersion && webhookVersion !== "1") {
          return new Response("Unsupported webhook version", { status: 400 });
        }

        const reference = deliverooRef(envelope.order);
        if (!reference) return new Response("Missing order id", { status: 400 });
        const status = latestDeliverooStatus(envelope.order);
        await recordIntegrationHeartbeat(
          "deliveroo_orders_api",
          `Orders API received ${envelope.event} · ${status || "unknown"}`,
        );

        if (
          envelope.event.includes("cancel") ||
          ["cancelled", "canceled", "rejected"].includes(status)
        ) {
          await cancelDeliverooOrder(reference);
          return Response.json({ ok: true, action: "cancelled" });
        }

        // A tablet-based site may send `placed` first. Café 1 only releases a
        // ticket after Deliveroo records acceptance, preventing rejected food waste.
        const accepted = deliverooWasAccepted(envelope.order) || envelope.event === "new_order";
        if (!accepted) {
          return Response.json({ ok: true, action: "awaiting_acceptance" });
        }

        try {
          const result = await ingestDeliverooOrder(
            asIngestOrder(envelope.order, reference),
            "webhook",
          );
          const siteMode = (process.env.DELIVEROO_SITE_MODE ?? "tablet").toLowerCase();
          if (siteMode === "tablet" || envelope.order.is_tabletless === false) {
            const synced = await pushDeliverooSyncStatus(reference, "succeeded");
            if (!synced) {
              return Response.json(
                { error: "KDS ticket stored but Deliveroo sync acknowledgement failed" },
                { status: 503 },
              );
            }
          }
          return Response.json({
            ok: true,
            action: result.duplicate ? "duplicate" : "kds_created",
            order_id: result.order_id,
          });
        } catch (error) {
          console.error("[deliveroo] KDS ingest failed", error);
          // A non-2xx response makes Deliveroo retry; never acknowledge a
          // payload that failed before the complete KDS ticket was stored.
          return Response.json({ error: "Could not create KDS ticket" }, { status: 503 });
        }
      },

      GET: async () => new Response("Deliveroo Orders API webhook ready"),
    },
  },
});
