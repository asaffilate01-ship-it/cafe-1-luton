import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  deliverooApiOrderId,
  deliverooCanonicalRef,
  deliverooReferenceKeys,
  deliverooWasAccepted,
  extractDeliverooEnvelope,
  latestDeliverooStatus,
  mapDeliverooType,
  verifyDeliverooSignature,
} from "./deliveroo.server";

describe("Deliveroo webhook security", () => {
  const secret = "deliveroo-webhook-secret-for-tests";
  const sequence = "1499765769";
  const raw = Buffer.from('{"event":"order.new","body":{"order":{"id":"gb:test"}}}');

  function signature(separator: string) {
    return createHmac("sha256", secret)
      .update(sequence)
      .update(separator)
      .update(raw)
      .digest("hex");
  }

  it("verifies the GUID, official separator and exact raw bytes", () => {
    expect(verifyDeliverooSignature(raw, signature(" "), secret, sequence)).toBe(true);
    expect(verifyDeliverooSignature(raw, signature(" "), secret, "different")).toBe(false);
    expect(
      verifyDeliverooSignature(Buffer.from(`${raw.toString()} `), signature(" "), secret, sequence),
    ).toBe(false);
    expect(verifyDeliverooSignature(raw, null, secret, sequence)).toBe(false);
  });

  it("supports the deprecated POS separator only when explicitly allowed", () => {
    const legacy = signature(" \n ");
    expect(verifyDeliverooSignature(raw, legacy, secret, sequence, "modern")).toBe(false);
    expect(verifyDeliverooSignature(raw, legacy, secret, sequence, "either")).toBe(true);
  });
});

describe("Deliveroo order events", () => {
  const order = {
    id: "gb:07fbb82a-ceb5-43ec-123f-18af89e3380a",
    display_id: "1753",
    status: "placed",
    status_log: [
      { at: "2026-08-10T09:00:00Z", status: "placed" },
      { at: "2026-08-10T09:01:00Z", status: "accepted" },
    ],
  };

  it("extracts the current Order Events body.order envelope", () => {
    const envelope = extractDeliverooEnvelope({ event: "order.status_update", body: { order } });
    expect(envelope?.event).toBe("order.status_update");
    expect(envelope?.order.id).toBe(order.id);
    expect(deliverooWasAccepted(envelope!.order)).toBe(true);
    expect(latestDeliverooStatus(envelope!.order)).toBe("accepted");
  });

  it("extracts deprecated accepted-order and cancellation envelopes during migration", () => {
    expect(extractDeliverooEnvelope({ event: "new_order", order })?.order.id).toBe(order.id);
    expect(extractDeliverooEnvelope({ event: "cancel_order", order })?.event).toBe("cancel_order");
  });

  it("uses the newest status-log timestamp when callbacks arrive out of order", () => {
    expect(
      latestDeliverooStatus({
        status: "placed",
        status_log: [...order.status_log].reverse(),
      }),
    ).toBe("accepted");
  });

  it("deduplicates every ingest path and restores only genuine API ids", () => {
    expect(deliverooCanonicalRef(order.id)).toBe(`deliveroo:${order.id}`);
    expect(deliverooReferenceKeys(order.id)).toContain(`hub:${order.id}`);
    expect(deliverooApiOrderId(`deliveroo:${order.id}`)).toBe(order.id);
    expect(deliverooApiOrderId("hub:1753")).toBeNull();
  });

  it("maps Deliveroo's customer fulfilment to collection", () => {
    expect(mapDeliverooType("customer")).toBe("collection");
    expect(mapDeliverooType("deliveroo")).toBe("delivery");
  });
});
