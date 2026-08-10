import { useEffect, useState, useSyncExternalStore } from "react";

export type ConsentPrefs = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
  expiresAt: string;
  version: number;
};

export const CONSENT_VERSION = 2;
export const CONSENT_MAX_AGE_DAYS = 180;
export const CONSENT_STORAGE_KEY = "cafe1_cookie_consent";

let cached: ConsentPrefs | null | undefined;
const listeners = new Set<() => void>();

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parseStoredConsent(raw: string | null, now = Date.now()): ConsentPrefs | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ConsentPrefs>;
    if (
      value.version !== CONSENT_VERSION ||
      value.necessary !== true ||
      typeof value.analytics !== "boolean" ||
      typeof value.marketing !== "boolean" ||
      !isValidDate(value.decidedAt) ||
      !isValidDate(value.expiresAt) ||
      Date.parse(value.expiresAt) <= now
    ) {
      return null;
    }
    return value as ConsentPrefs;
  } catch {
    return null;
  }
}

function read(): ConsentPrefs | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  const consent = parseStoredConsent(raw);
  if (raw && !consent) {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  }
  return consent;
}

function emit() {
  cached = undefined;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_STORAGE_KEY) emit();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

function snapshot(): ConsentPrefs | null {
  if (cached === undefined) cached = read();
  return cached;
}

export function saveConsent(prefs: { analytics: boolean; marketing: boolean }) {
  if (typeof window === "undefined") return;
  const decidedAt = new Date();
  const expiresAt = new Date(decidedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + CONSENT_MAX_AGE_DAYS);
  const value: ConsentPrefs = {
    necessary: true,
    analytics: prefs.analytics,
    marketing: prefs.marketing,
    decidedAt: decidedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    version: CONSENT_VERSION,
  };
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
  emit();
  window.dispatchEvent(new CustomEvent("cafe1:consent", { detail: value }));
}

export function clearConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONSENT_STORAGE_KEY);
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
