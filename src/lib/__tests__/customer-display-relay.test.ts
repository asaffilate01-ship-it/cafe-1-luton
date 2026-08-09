import { describe, expect, it } from "vitest";
import {
  buildDisplayRelayUrl,
  displayRelayTopic,
  generateDisplayRelayToken,
  isDisplayRelayToken,
  isRemoteDisplayMessage,
  signDisplayRelayPayload,
  verifyDisplayRelayEnvelope,
} from "../customer-display-relay";

const idle = { type: "idle" } as const;

describe("customer display relay", () => {
  it("creates a 256-bit pairing secret and keeps it in the URL fragment", () => {
    const token = generateDisplayRelayToken();
    expect(isDisplayRelayToken(token)).toBe(true);
    expect(generateDisplayRelayToken()).not.toBe(token);
    const url = buildDisplayRelayUrl(token, "https://cafe1stalbans.co.uk");
    expect(url).toBe(`https://cafe1stalbans.co.uk/display#pair=${token}`);
    expect(new URL(url).search).toBe("");
  });

  it("never permits juror credentials on the remote relay", () => {
    expect(isRemoteDisplayMessage(idle)).toBe(true);
    expect(
      isRemoteDisplayMessage({
        type: "juror_applied",
        code: "JURY-SECRET",
        pin: "123456",
        remaining_cents: 571,
        allocated_cents: 571,
        opted_in: true,
      }),
    ).toBe(false);
    expect(
      isRemoteDisplayMessage({
        type: "order",
        lines: [{ id: "1", name: "Tea", price_cents: 150, qty: 0 }],
        subtotal: 150,
        voucher_cents: 0,
        discount_cents: 0,
        due: 150,
        fulfilment: "dine_in",
      }),
    ).toBe(false);
  });

  it("accepts only fresh messages with a valid HMAC signature", async () => {
    const token = generateDisplayRelayToken();
    const now = 1_800_000_000_000;
    const envelope = await signDisplayRelayPayload(token, { kind: "state", message: idle }, now);
    await expect(verifyDisplayRelayEnvelope(token, envelope, now)).resolves.toMatchObject({
      kind: "state",
      message: idle,
    });
    await expect(
      verifyDisplayRelayEnvelope(token, { ...envelope, signature: "0".repeat(64) }, now),
    ).resolves.toBeNull();
    await expect(verifyDisplayRelayEnvelope(token, envelope, now + 121_000)).resolves.toBeNull();
  });

  it("uses a one-way topic identifier instead of exposing the pairing secret", async () => {
    const token = generateDisplayRelayToken();
    const topic = await displayRelayTopic(token);
    expect(topic).toMatch(/^cafe1-display-[a-f0-9]{40}$/);
    expect(topic).not.toContain(token);
  });
});
