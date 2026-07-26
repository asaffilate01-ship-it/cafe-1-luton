import { useSyncExternalStore } from "react";

const KEY = "cafe1-tab";

export type TabSession = { account_id: string; name: string; code: string } | null;

const listeners = new Set<() => void>();
let cached: TabSession = null;
let hydrated = false;

function read(): TabSession {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TabSession) : null;
  } catch { return null; }
}

function emit() { listeners.forEach((l) => l()); }

export const tab = {
  get(): TabSession {
    if (!hydrated && typeof window !== "undefined") { cached = read(); hydrated = true; }
    return cached;
  },
  set(s: TabSession) {
    cached = s; hydrated = true;
    if (typeof window !== "undefined") {
      if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
      else window.localStorage.removeItem(KEY);
    }
    emit();
  },
  clear() { this.set(null); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useTab(): TabSession {
  return useSyncExternalStore(tab.subscribe.bind(tab), tab.get.bind(tab), () => null);
}