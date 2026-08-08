export const DISPLAY_CHANNEL = "cafe1-customer-display";

const DISPLAY_STATE_KEY = "cafe1-customer-display-state-v2";
const DISPLAY_PRESENCE_KEY = "cafe1-customer-display-presence-v2";
const PAID_REPLAY_MS = 15_000;

export type DisplayLine = { id: string; name: string; price_cents: number; qty: number };

export type DisplayMessage =
  | {
      type: "order";
      lines: DisplayLine[];
      subtotal: number;
      voucher_cents: number;
      discount_cents: number;
      due: number;
      fulfilment: string;
    }
  | {
      type: "paid";
      order_number: number;
      total: number;
      method: "cash" | "card" | "split" | "voucher" | "account";
    }
  | { type: "juror"; url: string }
  | {
      type: "juror_applied";
      code: string;
      pin: string;
      remaining_cents: number;
      allocated_cents: number;
      opted_in: boolean;
    }
  | { type: "idle" };

export type DisplayPresenceMessage = {
  type: "display_presence";
  at: number;
};

type CachedDisplayState = {
  saved_at: number;
  message: Extract<DisplayMessage, { type: "order" | "paid" | "idle" }>;
};

function openChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
  return new BroadcastChannel(DISPLAY_CHANNEL);
}

function cacheable(
  message: DisplayMessage,
): message is Extract<DisplayMessage, { type: "order" | "paid" | "idle" }> {
  return message.type === "order" || message.type === "paid" || message.type === "idle";
}

function parseCachedState(raw: string | null): CachedDisplayState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CachedDisplayState>;
    if (!value.message || typeof value.saved_at !== "number" || !cacheable(value.message)) {
      return null;
    }
    if (value.message.type === "paid" && Date.now() - value.saved_at > PAID_REPLAY_MS) {
      return { saved_at: Date.now(), message: { type: "idle" } };
    }
    return value as CachedDisplayState;
  } catch {
    return null;
  }
}

/**
 * Mirrors a till event to the customer display. Basket snapshots are also
 * cached so a display that is opened or refreshed after the basket changed can
 * recover immediately. Voucher credentials are deliberately never persisted.
 */
export function postToDisplay(message: DisplayMessage) {
  if (typeof window === "undefined") return;
  if (cacheable(message)) {
    window.localStorage.setItem(
      DISPLAY_STATE_KEY,
      JSON.stringify({ saved_at: Date.now(), message } satisfies CachedDisplayState),
    );
  }
  const channel = openChannel();
  channel?.postMessage(message);
  channel?.close();
}

/** Listen across BroadcastChannel and the storage-event fallback. */
export function subscribeToDisplay(
  listener: (message: DisplayMessage) => void,
  options: { replay?: boolean } = {},
): () => void {
  if (typeof window === "undefined") return () => undefined;

  if (options.replay !== false) {
    const cached = parseCachedState(window.localStorage.getItem(DISPLAY_STATE_KEY));
    if (cached) listener(cached.message);
  }

  const channel = openChannel();
  if (channel) channel.onmessage = (event: MessageEvent<DisplayMessage>) => listener(event.data);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== DISPLAY_STATE_KEY) return;
    const cached = parseCachedState(event.newValue);
    if (cached) listener(cached.message);
  };
  window.addEventListener("storage", onStorage);

  return () => {
    channel?.close();
    window.removeEventListener("storage", onStorage);
  };
}

/** The display calls this regularly so the till can show a truthful status. */
export function announceDisplayPresence(at = Date.now()) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISPLAY_PRESENCE_KEY, String(at));
  const channel = openChannel();
  channel?.postMessage({ type: "display_presence", at } satisfies DisplayPresenceMessage);
  channel?.close();
}

export function readDisplayPresence(): number | null {
  if (typeof window === "undefined") return null;
  const value = Number(window.localStorage.getItem(DISPLAY_PRESENCE_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function subscribeToDisplayPresence(listener: (at: number) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const channel = openChannel();
  if (channel) {
    channel.onmessage = (event: MessageEvent<DisplayPresenceMessage | DisplayMessage>) => {
      if (event.data.type === "display_presence") listener(event.data.at);
    };
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== DISPLAY_PRESENCE_KEY) return;
    const at = Number(event.newValue);
    if (Number.isFinite(at) && at > 0) listener(at);
  };
  window.addEventListener("storage", onStorage);
  return () => {
    channel?.close();
    window.removeEventListener("storage", onStorage);
  };
}
