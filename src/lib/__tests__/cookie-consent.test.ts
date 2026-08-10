import { describe, expect, it } from "vitest";

import { CONSENT_MAX_AGE_DAYS, CONSENT_VERSION, parseStoredConsent } from "../cookie-consent";
import { analyticsConfigured, parseGaMeasurementId } from "../analytics-consent";

describe("cookie consent storage", () => {
  const now = Date.parse("2026-08-09T12:00:00.000Z");
  const valid = {
    necessary: true,
    analytics: false,
    marketing: true,
    decidedAt: "2026-08-09T12:00:00.000Z",
    expiresAt: "2027-02-05T12:00:00.000Z",
    version: CONSENT_VERSION,
  };

  it("accepts a current, explicit and unexpired preference", () => {
    expect(CONSENT_MAX_AGE_DAYS).toBe(180);
    expect(parseStoredConsent(JSON.stringify(valid), now)).toEqual(valid);
  });

  it("rejects malformed, legacy, incomplete and expired preferences", () => {
    expect(parseStoredConsent("not-json", now)).toBeNull();
    expect(parseStoredConsent(JSON.stringify({ ...valid, version: 1 }), now)).toBeNull();
    expect(parseStoredConsent(JSON.stringify({ ...valid, necessary: false }), now)).toBeNull();
    expect(
      parseStoredConsent(JSON.stringify({ ...valid, expiresAt: valid.decidedAt }), now),
    ).toBeNull();
  });
});

describe("analytics configuration", () => {
  it("accepts only GA4 measurement IDs", () => {
    expect(parseGaMeasurementId(" g-Abc12345 ")).toBe("G-ABC12345");
    expect(analyticsConfigured("G-ABC12345")).toBe(true);
    expect(parseGaMeasurementId("UA-123-1")).toBeNull();
    expect(analyticsConfigured("")).toBe(false);
  });
});
