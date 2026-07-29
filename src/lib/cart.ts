import { useSyncExternalStore } from "react";
import { orderContext } from "./order-context";

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
/** Carts are dropped after this much inactivity so a shared/kiosk device never
 *  shows the previous person's basket. */
const TTL_MS = 2 * 60 * 60 * 1000;
type State = { items: CartItem[] };
type Stored = State & { owner?: string | null; updated_at?: number };
/** null = guest. Set from the auth session so one person's basket never
 *  carries over to another account on the same browser. */
let owner: string | null = null;
let state: State = { items: [] };
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      const stale =
        typeof parsed.updated_at === "number" && Date.now() - parsed.updated_at > TTL_MS;
      if (stale) {
        localStorage.removeItem(KEY);
        return;
      }
      owner = parsed.owner ?? null;
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
  localStorage.setItem(
    KEY,
    JSON.stringify({ ...state, owner, updated_at: Date.now() } satisfies Stored),
  );
  // An empty basket means the order setup (dine in / pickup / delivery + time
  // slot) no longer applies — drop it so the next person starts clean.
  if (state.items.length === 0) orderContext.clear();
  listeners.forEach((l) => l());
}
load();

const EMPTY: State = { items: [] };

export const cart = {
  get: () => state,
  /**
   * Attach the basket to the current identity. If the stored basket belongs to
   * a different person (previous signed-in user, or a guest basket left on a
   * shared device before someone signs in), it is discarded.
   */
  syncOwner(userId: string | null) {
    if (owner === (userId ?? null)) return;
    // A guest basket is adopted by the person who signs in on this browser.
    // Anything else (different user, or signing out of an owned basket) is dropped.
    const adopt = owner === null && !!userId;
    owner = userId ?? null;
    if (!adopt) state = { items: [] };
    persist();
  },
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