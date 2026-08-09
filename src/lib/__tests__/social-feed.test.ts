import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadAutomaticSocialFeed,
  normaliseInstagramMedia,
  normaliseYouTubePlaylist,
  resetAutomaticSocialFeedCacheForTests,
} from "../social-feed.server";

afterEach(() => {
  resetAutomaticSocialFeedCacheForTests();
  vi.restoreAllMocks();
});

describe("automatic social feeds", () => {
  it("accepts only public, valid YouTube uploads", () => {
    const posts = normaliseYouTubePlaylist({
      items: [
        {
          status: { privacyStatus: "public" },
          snippet: { title: "Lunch special", resourceId: { videoId: "abcDEF12345" } },
        },
        {
          status: { privacyStatus: "private" },
          snippet: { title: "Private", resourceId: { videoId: "private12345" } },
        },
        {
          status: { privacyStatus: "public" },
          snippet: { title: "Deleted video", resourceId: { videoId: "deleted12345" } },
        },
      ],
    });
    expect(posts).toHaveLength(1);
    expect(posts[0]?.sourceUrl).toContain("abcDEF12345");
  });

  it("accepts only official Instagram video and Reel permalinks", () => {
    const posts = normaliseInstagramMedia({
      data: [
        {
          media_type: "VIDEO",
          media_product_type: "REELS",
          permalink: "https://www.instagram.com/reel/ABCdef123/",
          caption: "Fresh from the kitchen\nToday only",
        },
        {
          media_type: "IMAGE",
          permalink: "https://www.instagram.com/p/ImageCode1/",
        },
        {
          media_type: "VIDEO",
          permalink: "https://evil.example/reel/ABCdef123/",
        },
      ],
    });
    expect(posts).toHaveLength(1);
    expect(posts[0]?.title).toBe("Fresh from the kitchen");
  });

  it("loads configured providers without returning their secrets", async () => {
    const requests: string[] = [];
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      requests.push(url);
      if (url.includes("youtube")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                status: { privacyStatus: "public" },
                snippet: { title: "Café update", resourceId: { videoId: "abcDEF12345" } },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          data: [
            {
              media_type: "VIDEO",
              media_product_type: "REELS",
              permalink: "https://www.instagram.com/reel/ABCdef123/",
              caption: "Cafe Reel",
            },
          ],
        }),
        { status: 200 },
      );
    });

    const result = await loadAutomaticSocialFeed(fetchImpl as typeof fetch, {
      YOUTUBE_API_KEY: "youtube-secret-value",
      YOUTUBE_UPLOADS_PLAYLIST_ID: "uploads-playlist-123",
      INSTAGRAM_ACCESS_TOKEN: "instagram-secret-value",
      INSTAGRAM_GRAPH_VERSION: "v23.0",
    });

    expect(result.posts).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("youtube-secret-value");
    expect(JSON.stringify(result)).not.toContain("instagram-secret-value");
    expect(requests.some((url) => url.includes("youtube-secret-value"))).toBe(true);
    expect(requests.some((url) => url.includes("instagram-secret-value"))).toBe(true);
  });
});
