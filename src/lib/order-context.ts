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
let state: OrderContext | null = null;
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as OrderContext;
  } catch {}
}
function persist() {
  if (typeof window === "undefined") return;
  if (state) localStorage.setItem(KEY, JSON.stringify(state));
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