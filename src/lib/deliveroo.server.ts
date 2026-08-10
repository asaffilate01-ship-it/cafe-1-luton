import { createHmac, timingSafeEqual } from "node:crypto";

export type DeliverooMoney = { fractional?: number; currency_code?: string };

export type DeliverooItem = {
  name?: string;
  quantity?: number;
  unit_price?: DeliverooMoney;
  price?: DeliverooMoney;
  modifiers?: Array<{ name?: string; quantity?: number }>;
  operational_name?: string;
};

export type DeliverooOrderPayload = {
  id?: string;
  order_id?: string;
  order_number?: string;
  display_id?: string | number;
  location_id?: string;
  status?: string;
  status_log?: Array<{ at?: string; status?: string }>;
  fulfillment_type?: string;
  order_type?: string;
  cutlery_notes?: string;
  note_to_restaurant?: string;
  order_notes?: string;
  customer?: {
    name?: string;
    contact_number?: string;
    first_name?: string;
    last_name?: string;
  };
  items?: DeliverooItem[];
  total_price?: DeliverooMoney;
  subtotal?: DeliverooMoney;
  partner_order_total?: DeliverooMoney;
  prepare_for?: string;
  start_preparing_at?: string;
  confirm_at?: string;
  asap?: boolean;
  is_tabletless?: boolean;
  delivery?: {
    address?: { line_1?: string; line_2?: string; city?: string; post_code?: string };
    notes?: string;
    delivery_notes?: string;
    line1?: string;
    line2?: string;
    city?: string;
    postcode?: string;
    contact_number?: string;
  };
};

export type DeliverooEnvelope = {
  event: string;
  order: DeliverooOrderPayload;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeEqualHex(providedHeader: string | null, expected: string): boolean {
  if (!providedHeader) return false;
  const provided = providedHeader
    .trim()
    .toLowerCase()
    .replace(/^sha256=/, "");
  if (!/^[0-9a-f]{64}$/.test(provided) || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
}

/**
 * Verify a Deliveroo webhook over the exact bytes received. Deliveroo signs
 * `sequence-guid + separator + raw-body`; modern events use one space while
 * the deprecated POS events use ` space + newline + space`.
 */
export function verifyDeliverooSignature(
  rawBody: Uint8Array | string,
  signatureHeader: string | null,
  secret: string,
  sequenceGuid: string | null,
  mode: "modern" | "legacy" | "either" = "modern",
): boolean {
  if (!secret || !sequenceGuid || !signatureHeader) return false;
  const body = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : Buffer.from(rawBody);
  const signatureFor = (separator: string) =>
    createHmac("sha256", secret)
      .update(sequenceGuid, "utf8")
      .update(separator, "utf8")
      .update(body)
      .digest("hex");

  if (mode !== "legacy" && safeEqualHex(signatureHeader, signatureFor(" "))) return true;
  return mode !== "modern" && safeEqualHex(signatureHeader, signatureFor(" \n "));
}

/** Accept both the modern `body.order` and deprecated top-level order envelopes. */
export function extractDeliverooEnvelope(value: unknown): DeliverooEnvelope | null {
  if (!isRecord(value)) return null;
  const event = String(value.event ?? value.event_type ?? "")
    .trim()
    .toLowerCase();
  const body = isRecord(value.body) ? value.body : null;
  const data = isRecord(value.data) ? value.data : null;
  const orderCandidate = body?.order ?? data?.order ?? value.order ?? value.data;
  if (!event || !isRecord(orderCandidate)) return null;
  return { event, order: orderCandidate as DeliverooOrderPayload };
}

/** Map Deliveroo fulfilment types to the order types used by Café 1. */
export function mapDeliverooType(value?: string): "delivery" | "collection" {
  const type = (value ?? "").toLowerCase();
  if (/collect|pick.?up|takeaway|customer/.test(type)) return "collection";
  return "delivery";
}

/** Extract the stable Deliveroo API order id (not the human display number). */
export function deliverooRef(payload: DeliverooOrderPayload): string | null {
  return (
    payload.order_id ||
    payload.id ||
    (payload.display_id != null ? String(payload.display_id) : null)
  );
}

export function deliverooCanonicalRef(reference: string): string {
  return `deliveroo:${reference.trim()}`;
}

/** Includes old prefixes so upgrading cannot create a second ticket for a live order. */
export function deliverooReferenceKeys(reference: string): string[] {
  const ref = reference.trim();
  return [
    ...new Set([deliverooCanonicalRef(ref), ref, `webhook:${ref}`, `hub:${ref}`, `print:${ref}`]),
  ];
}

/** Return an API-compatible {market}:{uuid} id from a stored idempotency value. */
export function deliverooApiOrderId(storedReference: string): string | null {
  const candidate = storedReference.replace(/^(?:deliveroo|webhook):/i, "");
  return /^[a-z]{2}:[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(candidate) ? candidate : null;
}

/** Status log is Deliveroo's source of truth because callbacks can arrive out of order. */
export function latestDeliverooStatus(payload: DeliverooOrderPayload): string {
  const entries = (payload.status_log ?? [])
    .filter((entry) => typeof entry.status === "string")
    .map((entry, index) => ({
      status: String(entry.status).toLowerCase(),
      at: entry.at && Number.isFinite(Date.parse(entry.at)) ? Date.parse(entry.at) : index,
    }))
    .sort((a, b) => a.at - b.at);
  return entries.at(-1)?.status ?? String(payload.status ?? "").toLowerCase();
}

export function deliverooWasAccepted(payload: DeliverooOrderPayload): boolean {
  return (
    (payload.status_log ?? []).some((entry) =>
      ["accepted", "confirmed"].includes(String(entry.status ?? "").toLowerCase()),
    ) || ["accepted", "confirmed"].includes(String(payload.status ?? "").toLowerCase())
  );
}

export function deliverooLineCents(item: DeliverooItem): number {
  const amount = item.unit_price?.fractional ?? item.price?.fractional;
  return typeof amount === "number" && Number.isFinite(amount)
    ? Math.max(0, Math.round(amount))
    : 0;
}
