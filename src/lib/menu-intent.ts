import type { OrderContext } from "./order-context";

export const MENU_BROWSING_SESSION_KEY = "cafe1_menu_browsing_v1";

type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserSessionStore(): SessionStore | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Remember browsing only for this tab; it is not an order and carries no customer data. */
export function hasMenuBrowsingIntent(store: SessionStore | null = browserSessionStore()) {
  if (!store) return false;
  try {
    return store.getItem(MENU_BROWSING_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMenuBrowsingIntent(
  browsing: boolean,
  store: SessionStore | null = browserSessionStore(),
) {
  if (!store) return;
  try {
    if (browsing) store.setItem(MENU_BROWSING_SESSION_KEY, "1");
    else store.removeItem(MENU_BROWSING_SESSION_KEY);
  } catch {
    // Browsing still works when storage is unavailable; only the tab preference is lost.
  }
}

/** Browsing never silently defaults a real basket to pickup at checkout. */
export function requiresOrderSetup(context: OrderContext | null, itemCount: number) {
  return itemCount > 0 && context === null;
}
