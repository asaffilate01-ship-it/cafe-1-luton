import { afterEach, describe, expect, it } from "vitest";
import { bridgeSecretMatches, readBridgeSecret } from "@/lib/deliveroo-ingest.server";

const originalSecret = process.env.DELIVEROO_BRIDGE_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.DELIVEROO_BRIDGE_SECRET;
  else process.env.DELIVEROO_BRIDGE_SECRET = originalSecret;
});

describe("Deliveroo watcher authentication", () => {
  it("fails closed when the bridge is not configured", () => {
    delete process.env.DELIVEROO_BRIDGE_SECRET;
    expect(bridgeSecretMatches("a".repeat(64))).toBe(false);
  });

  it("accepts only the exact high-entropy bridge key", () => {
    process.env.DELIVEROO_BRIDGE_SECRET = "1".repeat(64);
    expect(bridgeSecretMatches("1".repeat(64))).toBe(true);
    expect(bridgeSecretMatches("1".repeat(63))).toBe(false);
    expect(bridgeSecretMatches(`${"1".repeat(63)}2`)).toBe(false);
  });

  it("reads the dedicated header before the bearer fallback", () => {
    const request = new Request("https://cafe1luton.co.uk", {
      headers: {
        "x-bridge-secret": "device-key",
        authorization: "Bearer old-key",
      },
    });
    expect(readBridgeSecret(request)).toBe("device-key");
  });
});
