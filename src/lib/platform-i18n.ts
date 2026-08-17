import { useCallback, useEffect, useState } from "react";

export type PlatformLocale = "en" | "de";

const STORAGE_KEY = "dishbee.locale";
const GERMAN_REGIONS = ["DE", "AT", "CH"];
const GERMAN_TIMEZONES = [
  "Europe/Berlin",
  "Europe/Busingen",
  "Europe/Vienna",
  "Europe/Zurich",
];

/** Best-effort guess of whether the visitor is in DE / AT / CH. */
export function detectLocale(): PlatformLocale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "de" || stored === "en") return stored;
  } catch {
    /* storage blocked */
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && GERMAN_TIMEZONES.includes(tz)) return "de";
  } catch {
    /* Intl unavailable */
  }
  const langs: string[] = [
    ...(navigator.languages ?? []),
    navigator.language ?? "",
  ].filter(Boolean);
  for (const raw of langs) {
    const tag = raw.toLowerCase();
    if (tag.startsWith("de")) return "de";
    const region = tag.split("-")[1]?.toUpperCase();
    if (region && GERMAN_REGIONS.includes(region)) return "de";
  }
  return "en";
}

/**
 * Locale for the dishbee marketing pages. Starts as "en" so SSR and the first
 * client render match, then switches on the client once detection has run.
 */
export function usePlatformLocale() {
  const [locale, setLocaleState] = useState<PlatformLocale>("en");

  useEffect(() => {
    const detected = detectLocale();
    if (detected !== "en") setLocaleState(detected);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: PlatformLocale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked */
    }
  }, []);

  return { locale, setLocale };
}
