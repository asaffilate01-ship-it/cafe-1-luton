// Shared browser-safe helpers for store status.
export type HourRow = { day_of_week: number; open_time: string; close_time: string; closed: boolean };
export type BusinessSettings = {
  id: string;
  name: string;
  accepting_orders: boolean;
  allow_preorder_when_closed: boolean;
  prep_minutes: number;
  delivery_minutes: number;
  min_order_cents: number;
  delivery_fee_cents: number;
  free_delivery_threshold_cents: number | null;
  closed_message: string | null;
};

export const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function toMinutes(t: string) {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return h * 60 + (m || 0);
}

export type StoreStatus = {
  open: boolean;
  reason: "closed_day" | "before_open" | "after_close" | "not_accepting" | "open";
  todayOpen?: string;
  todayClose?: string;
  nextOpenLabel?: string;
};

export function computeStoreStatus(
  hours: HourRow[],
  settings: BusinessSettings | null,
  now = new Date(),
): StoreStatus {
  if (settings && !settings.accepting_orders) {
    return { open: false, reason: "not_accepting" };
  }
  const dow = now.getDay();
  const today = hours.find((h) => h.day_of_week === dow);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (!today || today.closed) {
    return { open: false, reason: "closed_day", nextOpenLabel: findNextOpen(hours, dow) };
  }
  const o = toMinutes(today.open_time), c = toMinutes(today.close_time);
  if (nowMin < o) return { open: false, reason: "before_open", todayOpen: today.open_time, todayClose: today.close_time };
  if (nowMin >= c) return { open: false, reason: "after_close", todayOpen: today.open_time, todayClose: today.close_time, nextOpenLabel: findNextOpen(hours, dow + 1) };
  return { open: true, reason: "open", todayOpen: today.open_time, todayClose: today.close_time };
}

function findNextOpen(hours: HourRow[], fromDow: number): string | undefined {
  for (let i = 0; i < 7; i++) {
    const d = (fromDow + i) % 7;
    const row = hours.find((h) => h.day_of_week === d);
    if (row && !row.closed) return `${DAY_NAMES[d]} · ${row.open_time.slice(0,5)}`;
  }
  return undefined;
}

export function formatHHMM(t: string) {
  return t.slice(0, 5);
}