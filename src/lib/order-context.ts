import { useSyncExternalStore } from "react";

export type OrderMode = "collection" | "delivery" | "dine_in";
export type ScheduleMode = "asap" | "scheduled";

export type OrderContext = {
  mode: OrderMode;
  schedule_mode: ScheduleMode;
  scheduled_for?: string;
  postcode?: string;
  distance_m?: number;
};

const KEY = "cafe1_order_ctx_v1";
/** Matches the cart TTL — a stale setup on a shared device is discarded. */
const TTL_MS = 2 * 60 * 60 * 1000;
let state: OrderContext | null = null;
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OrderContext & { updated_at?: number };
      if (typeof parsed.updated_at === "number" && Date.now() - parsed.updated_at > TTL_MS) {
        localStorage.removeItem(KEY);
      } else {
        state = parsed;
      }
    }
  } catch {}
}
function persist() {
  if (typeof window === "undefined") return;
  if (state) localStorage.setItem(KEY, JSON.stringify({ ...state, updated_at: Date.now() }));
  else localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}
load();

export const orderContext = {
  get: () => state,
  set(next: OrderContext) {
    state = next;
    persist();
  },
  clear() {
    state = null;
    persist();
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useOrderContext() {
  return useSyncExternalStore(
    (cb) => orderContext.subscribe(cb),
    () => state,
    () => null,
  );
}

export function describeContext(ctx: OrderContext | null): string {
  if (!ctx) return "Set up order";
  const modeLabel =
    ctx.mode === "collection" ? "Pickup" : ctx.mode === "dine_in" ? "Dine in" : "Delivery";
  const when =
    ctx.schedule_mode === "asap"
      ? "ASAP"
      : ctx.scheduled_for
        ? new Date(ctx.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "Later";
  const post = ctx.mode === "delivery" && ctx.postcode ? ` · ${ctx.postcode.toUpperCase()}` : "";
  return `${modeLabel} · ${when}${post}`;
}