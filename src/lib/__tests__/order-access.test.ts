import { describe, expect, it } from "vitest";

import { hashTrackingToken } from "../order-access.server";

describe("guest order tracking tokens", () => {
  it("hashes tokens deterministically without storing the bearer value", () => {
    const token = "secure-random-tracking-token-with-more-than-32-characters";
    const hash = hashTrackingToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash).toBe(hashTrackingToken(token));
    expect(hash).not.toContain(token);
    expect(hash).not.toBe(hashTrackingToken(`${token}-different`));
  });
});
