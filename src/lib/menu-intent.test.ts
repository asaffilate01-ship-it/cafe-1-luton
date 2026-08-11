import { describe, expect, it } from "vitest";
import {
  MENU_BROWSING_SESSION_KEY,
  hasMenuBrowsingIntent,
  requiresOrderSetup,
  setMenuBrowsingIntent,
} from "./menu-intent";

function memoryStore() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("public menu intent", () => {
  it("remembers Just browsing only in the supplied session store", () => {
    const store = memoryStore();
    expect(hasMenuBrowsingIntent(store)).toBe(false);
    setMenuBrowsingIntent(true, store);
    expect(store.getItem(MENU_BROWSING_SESSION_KEY)).toBe("1");
    expect(hasMenuBrowsingIntent(store)).toBe(true);
    setMenuBrowsingIntent(false, store);
    expect(hasMenuBrowsingIntent(store)).toBe(false);
  });

  it("requires order setup once a browsing customer proceeds with a basket", () => {
    expect(requiresOrderSetup(null, 0)).toBe(false);
    expect(requiresOrderSetup(null, 1)).toBe(true);
    expect(requiresOrderSetup({ mode: "collection", schedule_mode: "asap" }, 1)).toBe(false);
  });
});
