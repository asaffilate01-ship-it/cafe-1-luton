import { afterEach, describe, expect, it, vi } from "vitest";

import { loadGoogleReviews, resetGoogleReviewsCacheForTests } from "../google-reviews.server";

const originalEnvironment = {
  GOOGLE_PLACE_ID: process.env.GOOGLE_PLACE_ID,
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  LOVABLE_API_KEY: process.env.LOVABLE_API_KEY,
};

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  resetGoogleReviewsCacheForTests();
  vi.restoreAllMocks();
});

describe("Google Reviews provider fallback", () => {
  it("uses the direct Places API when the Lovable connector is unavailable", async () => {
    process.env.GOOGLE_PLACE_ID = "ChIJcafe1StAlbans12345";
    process.env.GOOGLE_MAPS_API_KEY = "server-maps-key";
    process.env.LOVABLE_API_KEY = "lovable-connector-key";
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      if (calls.length === 1) return new Response("unavailable", { status: 503 });
      return new Response(
        JSON.stringify({
          rating: 4.8,
          userRatingCount: 42,
          googleMapsUri: "https://www.google.com/maps/place/cafe1",
          reviews: [
            {
              rating: 5,
              text: { text: "Excellent lunch" },
              relativePublishTimeDescription: "a week ago",
              authorAttribution: {
                displayName: "Customer",
                uri: "https://www.google.com/maps/contrib/123",
              },
            },
          ],
        }),
        { status: 200 },
      );
    });

    const result = await loadGoogleReviews(fetchImpl as typeof fetch);

    expect(result.available).toBe(true);
    expect(result.reviews[0]?.author).toBe("Customer");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.url).toContain("places.googleapis.com/v1/places/");
    expect(new Headers(calls[1]?.init?.headers).get("X-Goog-Api-Key")).toBe("server-maps-key");
    expect(JSON.stringify(result)).not.toContain("server-maps-key");
  });

  it("fails safely when the server key is absent", async () => {
    process.env.GOOGLE_PLACE_ID = "ChIJcafe1StAlbans12345";
    delete process.env.GOOGLE_MAPS_API_KEY;
    const fetchImpl = vi.fn();

    const result = await loadGoogleReviews(fetchImpl as typeof fetch);

    expect(result.configured).toBe(false);
    expect(result.available).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
