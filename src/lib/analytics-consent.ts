export const ANALYTICS_SCRIPT_ID = "cafe1-google-analytics";

export function parseGaMeasurementId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toUpperCase();
  return /^G-[A-Z0-9]{6,20}$/.test(value) ? value : null;
}

export function analyticsConfigured(raw: unknown): boolean {
  return parseGaMeasurementId(raw) !== null;
}
