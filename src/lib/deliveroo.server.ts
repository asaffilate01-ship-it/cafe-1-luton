import { createHmac, timingSafeEqual } from "node:crypto";

/** Verify Deliveroo's HMAC-SHA256 signature over the raw request body. */
export function verifyDeliverooSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  // Deliveroo sends the hex-encoded HMAC-SHA256 of the raw body in `x-deliveroo-hmac-sha256`
  // (some tenants use `x-deliveroo-signature`). Compare in constant time.
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.trim().toLowerCase().replace(/^sha256=/, "");
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/** Map Deliveroo fulfillment types to our order_type enum. */
export function mapDeliverooType(t?: string): "delivery" | "collection" {
  const v = (t ?? "").toLowerCase();
  if (v.includes("collect") || v.includes("pickup") || v.includes("takeaway")) return "collection";
  return "delivery";
}

export type DeliverooItem = {
  name?: string;
  quantity?: number;
  unit_price?: { fractional?: number };
  price?: { fractional?: number };
  modifiers?: Array<{ name?: string }>;
  operational_name?: string;
};

export type DeliverooOrderPayload = {
  id?: string;
  order_id?: string;
  display_id?: string | number;
  status?: string;
  fulfillment_type?: string;
  order_type?: string;
  cutlery_notes?: string;
  note_to_restaurant?: string;
  customer?: { name?: string; contact_number?: string; first_name?: string; last_name?: string };
  items?: DeliverooItem[];
  total_price?: { fractional?: number };
  subtotal?: { fractional?: number };
  prepare_for?: string; // ISO time when order should be ready
  asap?: boolean;
  delivery?: {
    address?: { line_1?: string; line_2?: string; city?: string; post_code?: string };
    notes?: string;
  };
};

/** Extract a stable Deliveroo order reference from any of the id fields. */
export function deliverooRef(p: DeliverooOrderPayload): string | null {
  return p.order_id || p.id || (p.display_id != null ? String(p.display_id) : null);
}