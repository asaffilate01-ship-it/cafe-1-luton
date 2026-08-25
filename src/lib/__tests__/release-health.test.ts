import { describe, expect, it } from "vitest";

import { createReleaseHealthPayload, createReleaseHealthResponse } from "../release-health.server";

describe("release health", () => {
  it("exposes only stable non-secret deployment metadata", async () => {
    const release = "ABCDEF0123456789ABCDEF0123456789ABCDEF01";
    const payload = createReleaseHealthPayload({
      PUBLIC_RELEASE_SHA: release,
      SUPABASE_SERVICE_ROLE_KEY: "must-not-leak",
    });

    expect(payload).toEqual({
      status: "ok",
      service: "cafe1-luton",
      postcode: "LU1 2AA",
      release: release.toLowerCase(),
    });
    expect(JSON.stringify(payload)).not.toContain("must-not-leak");
  });

  it("does not claim an invalid or missing release", async () => {
    expect(createReleaseHealthPayload({}).release).toBe("unconfigured");
    expect(createReleaseHealthPayload({ PUBLIC_RELEASE_SHA: "main" }).release).toBe("unconfigured");
  });

  it("prevents health responses being cached", async () => {
    const response = createReleaseHealthResponse({
      PUBLIC_RELEASE_SHA: "3e0b4f1e1c51a1b9437faa8a2eb0e7ee5c7c55c6",
    });

    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("cdn-cache-control")).toBe("no-store");
    expect((await response.json()).status).toBe("ok");
  });
});
