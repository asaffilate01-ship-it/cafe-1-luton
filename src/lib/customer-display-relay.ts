import type { DisplayMessage } from "./customer-display";

const RELAY_TOKEN_KEY = "cafe1-customer-display-relay-token-v1";
const RELAY_VERSION = 1 as const;
const MAX_CLOCK_SKEW_MS = 2 * 60_000;

export type RemoteDisplayMessage = Extract<
  DisplayMessage,
  { type: "order" | "paid" | "idle" | "qr" }
>;

export type DisplayRelayPayload =
  | {
      kind: "state";
      sent_at: number;
      nonce: string;
      message: RemoteDisplayMessage;
    }
  | {
      kind: "presence";
      sent_at: number;
      nonce: string;
    };

export type DisplayRelayEnvelope = {
  version: typeof RELAY_VERSION;
  payload: DisplayRelayPayload;
  signature: string;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function isSafeInteger(value: unknown, max = 10_000_000): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max;
}

export function isDisplayRelayToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function generateDisplayRelayToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function readDisplayRelayToken(): string {
  if (typeof window === "undefined") return "";
  const value = window.localStorage.getItem(RELAY_TOKEN_KEY) ?? "";
  return isDisplayRelayToken(value) ? value : "";
}

export function saveDisplayRelayToken(token: string): void {
  if (typeof window === "undefined") return;
  if (!isDisplayRelayToken(token)) throw new Error("Customer-display pairing token is invalid");
  window.localStorage.setItem(RELAY_TOKEN_KEY, token);
}

export function clearDisplayRelayToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(RELAY_TOKEN_KEY);
}

/**
 * Pairing secrets travel in the URL fragment, which browsers do not send in
 * HTTP requests, access logs or Referrer headers. The fragment is removed as
 * soon as the display stores it locally.
 */
export function consumeDisplayRelayTokenFromHash(): string {
  if (typeof window === "undefined" || !window.location.hash) return "";
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("pair") ?? "";
  if (!isDisplayRelayToken(token)) return "";
  saveDisplayRelayToken(token);
  params.delete("pair");
  const remaining = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}${remaining ? `#${remaining}` : ""}`,
  );
  return token;
}

export function buildDisplayRelayUrl(token: string, origin?: string): string {
  if (!isDisplayRelayToken(token)) throw new Error("Customer-display pairing token is invalid");
  const base = origin ?? (typeof window === "undefined" ? "" : window.location.origin);
  if (!base) return "";
  return `${base.replace(/\/$/, "")}/display#pair=${token}`;
}

export function isRemoteDisplayMessage(value: unknown): value is RemoteDisplayMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  if (message.type === "idle") return true;
  if (message.type === "paid") {
    return (
      isSafeInteger(message.order_number, 100_000_000) &&
      isSafeInteger(message.total) &&
      ["cash", "card", "split", "voucher", "account"].includes(String(message.method))
    );
  }
  if (message.type === "qr") {
    const url = typeof message.url === "string" ? message.url : "";
    const okText = (value: unknown) =>
      value === undefined || (typeof value === "string" && value.length <= 120);
    return (
      url.length > 0 &&
      url.length <= 400 &&
      (url.startsWith("https://") || url.startsWith("/")) &&
      okText(message.title) &&
      okText(message.subtitle)
    );
  }
  if (message.type !== "order" || !Array.isArray(message.lines) || message.lines.length > 100) {
    return false;
  }
  const linesValid = message.lines.every((line) => {
    if (!line || typeof line !== "object") return false;
    const item = line as Record<string, unknown>;
    return (
      typeof item.id === "string" &&
      item.id.length <= 100 &&
      typeof item.name === "string" &&
      item.name.length > 0 &&
      item.name.length <= 200 &&
      isSafeInteger(item.price_cents) &&
      isSafeInteger(item.qty, 100) &&
      item.qty > 0
    );
  });
  return (
    linesValid &&
    isSafeInteger(message.subtotal) &&
    isSafeInteger(message.voucher_cents) &&
    isSafeInteger(message.discount_cents) &&
    isSafeInteger(message.due) &&
    typeof message.fulfilment === "string" &&
    message.fulfilment.length <= 40
  );
}

function canonicalPayload(payload: DisplayRelayPayload): string {
  return JSON.stringify(payload);
}

async function hmac(token: string, payload: DisplayRelayPayload): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(canonicalPayload(payload)));
  return bytesToHex(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function displayRelayTopic(token: string): Promise<string> {
  if (!isDisplayRelayToken(token)) throw new Error("Customer-display pairing token is invalid");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return `cafe1-display-${bytesToHex(new Uint8Array(digest)).slice(0, 40)}`;
}

export async function signDisplayRelayPayload(
  token: string,
  input:
    | { kind: "state"; message: RemoteDisplayMessage }
    | { kind: "presence" },
  now = Date.now(),
): Promise<DisplayRelayEnvelope> {
  if (!isDisplayRelayToken(token)) throw new Error("Customer-display pairing token is invalid");
  const payload: DisplayRelayPayload =
    input.kind === "state"
      ? { kind: "state", sent_at: now, nonce: crypto.randomUUID(), message: input.message }
      : { kind: "presence", sent_at: now, nonce: crypto.randomUUID() };
  return { version: RELAY_VERSION, payload, signature: await hmac(token, payload) };
}

export async function verifyDisplayRelayEnvelope(
  token: string,
  value: unknown,
  now = Date.now(),
): Promise<DisplayRelayPayload | null> {
  if (!isDisplayRelayToken(token) || !value || typeof value !== "object") return null;
  const envelope = value as Partial<DisplayRelayEnvelope>;
  const payload = envelope.payload as Partial<DisplayRelayPayload> | undefined;
  if (
    envelope.version !== RELAY_VERSION ||
    !payload ||
    (payload.kind !== "state" && payload.kind !== "presence") ||
    !isSafeInteger(payload.sent_at, Number.MAX_SAFE_INTEGER) ||
    Math.abs(now - payload.sent_at) > MAX_CLOCK_SKEW_MS ||
    typeof payload.nonce !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(payload.nonce) ||
    typeof envelope.signature !== "string" ||
    !/^[a-f0-9]{64}$/.test(envelope.signature)
  ) {
    return null;
  }
  if (payload.kind === "state" && !isRemoteDisplayMessage(payload.message)) return null;
  const expected = await hmac(token, payload as DisplayRelayPayload);
  return constantTimeEqual(expected, envelope.signature) ? (payload as DisplayRelayPayload) : null;
}
