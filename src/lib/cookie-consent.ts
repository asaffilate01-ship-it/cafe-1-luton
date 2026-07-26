import { useEffect, useState, useSyncExternalStore } from "react";

export type ConsentPrefs = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
  version: number;
};

export const CONSENT_VERSION = 1;
const KEY = "cafe1_cookie_consent";

let cached: ConsentPrefs | null | undefined;
const listeners = new Set<() => void>();

function read(): ConsentPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ConsentPrefs;
    if (p.version !== CONSENT_VERSION) return null;
    return p;
  } catch {
    return null;
  }
}

function emit() {
  cached = undefined;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function snapshot(): ConsentPrefs | null {
  if (cached === undefined) cached = read();
  return cached;
}

export function saveConsent(prefs: { analytics: boolean; marketing: boolean }) {
  if (typeof window === "undefined") return;
  const value: ConsentPrefs = {
    necessary: true,
    analytics: prefs.analytics,
    marketing: prefs.marketing,
    decidedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  window.localStorage.setItem(KEY, JSON.stringify(value));
  emit();
  window.dispatchEvent(new CustomEvent("cafe1:consent", { detail: value }));
}

export function clearConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  emit();
}

/** Opens the cookie preferences panel from anywhere (e.g. footer link). */
export function openCookieSettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("cafe1:open-cookie-settings"));
}

export function useConsent() {
  const consent = useSyncExternalStore(subscribe, snapshot, () => null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return {
    hydrated,
    consent: hydrated ? consent : null,
    /** true only when the visitor has actively allowed that category */
    allows: (cat: "necessary" | "analytics" | "marketing") =>
      cat === "necessary" ? true : Boolean(hydrated && consent?.[cat]),
  };
}