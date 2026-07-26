import { useSyncExternalStore } from "react";

export type CartModifier = { id: string; name: string; price_cents: number };

export type CartItem = {
  /** Unique per menu item + chosen modifier combination. */
  id: string;
  menu_item_id: string;
  name: string;
  /** Base item price plus all chosen modifiers. */
  price_cents: number;
  base_price_cents: number;
  qty: number;
  modifiers: CartModifier[];
  notes?: string;
};

export function lineId(menuItemId: string, modifiers: { id: string }[]) {
  const ids = modifiers.map((m) => m.id).sort();
  return ids.length ? `${menuItemId}::${ids.join("+")}` : menuItemId;
}

const KEY = "cafe1_cart_v1";
type State = { items: CartItem[] };
let state: State = { items: [] };
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      // Migrate older carts that predate modifier support.
      state = {
        items: (parsed.items ?? []).map((i) => ({
          ...i,
          menu_item_id: i.menu_item_id ?? i.id,
          modifiers: i.modifiers ?? [],
          base_price_cents: i.base_price_cents ?? i.price_cents,
        })),
      };
    }
  } catch {}
}
function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}
load();

const EMPTY: State = { items: [] };

export const cart = {
  get: () => state,
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  add(
    item: {
      menu_item_id: string;
      name: string;
      base_price_cents: number;
      modifiers?: CartModifier[];
      notes?: string;
    },
    qty = 1,
  ) {
    const modifiers = item.modifiers ?? [];
    const id = lineId(item.menu_item_id, modifiers);
    const price_cents =
      item.base_price_cents + modifiers.reduce((s, m) => s + m.price_cents, 0);
    const existing = state.items.find((i) => i.id === id);
    if (existing) existing.qty += qty;
    else
      state.items.push({
        id,
        menu_item_id: item.menu_item_id,
        name: item.name,
        base_price_cents: item.base_price_cents,
        price_cents,
        modifiers,
        notes: item.notes,
        qty,
      });
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
};

export function useCart() {
  return useSyncExternalStore(
    (cb) => cart.subscribe(cb),
    () => state,
    () => EMPTY,
  );
}