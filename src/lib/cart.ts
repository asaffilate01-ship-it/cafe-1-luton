import { useSyncExternalStore } from "react";

export type CartItem = {
  id: string;
  name: string;
  price_cents: number;
  qty: number;
  notes?: string;
};

const KEY = "cafe1_cart_v1";
type State = { items: CartItem[] };
let state: State = { items: [] };
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw);
  } catch {}
}
function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}
load();

export const cart = {
  get: () => state,
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  add(item: Omit<CartItem, "qty">, qty = 1) {
    const existing = state.items.find((i) => i.id === item.id);
    if (existing) existing.qty += qty;
    else state.items.push({ ...item, qty });
    state = { items: [...state.items] };
    persist();
  },
  setQty(id: string, qty: number) {
    state = {
      items: state.items
        .map((i) => (i.id === id ? { ...i, qty } : i))
        .filter((i) => i.qty > 0),
    };
    persist();
  },
  remove(id: string) {
    state = { items: state.items.filter((i) => i.id !== id) };
    persist();
  },
  clear() {
    state = { items: [] };
    persist();
  },
  total() {
    return state.items.reduce((s, i) => s + i.price_cents * i.qty, 0);
  },
  count() {
    return state.items.reduce((s, i) => s + i.qty, 0);
  },
};

export function useCart() {
  return useSyncExternalStore(
    (cb) => cart.subscribe(cb),
    () => state,
    () => ({ items: [] }),
  );
}