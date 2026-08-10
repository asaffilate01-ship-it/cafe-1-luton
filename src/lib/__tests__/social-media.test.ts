import { describe, expect, it } from "vitest";

import {
  createSocialPost,
  createSocialProfiles,
  facebookPagePluginUrl,
  findSocialProfile,
  mergeSocialPosts,
  parseSocialPosts,
  tiktokCreatorHandle,
  tiktokCreatorEmbedUrl,
} from "../social-media";

describe("social media embed configuration", () => {
  it("creates privacy-enhanced YouTube and official TikTok players", () => {
    expect(
      createSocialPost("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.embedUrl,
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(
      createSocialPost("tiktok", "https://www.tiktok.com/@cafe1_stalbans/video/1234567890123456789")
        ?.embedUrl,
    ).toContain("www.tiktok.com/player/v1/1234567890123456789");
  });

  it("rejects untrusted or malformed sources", () => {
    expect(createSocialPost("youtube", "javascript:alert(1)")).toBeNull();
    expect(createSocialPost("instagram", "https://example.com/reel/not-cafe1")).toBeNull();
    expect(createSocialPost("tiktok", "https://www.tiktok.com/@cafe1_stalbans")).toBeNull();
  });

  it("ignores invalid JSON entries and de-duplicates players", () => {
    const value = JSON.stringify([
      { platform: "instagram", url: "https://www.instagram.com/reel/ABCdef123/", title: "Lunch" },
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/ABCdef123/",
        title: "Duplicate",
      },
      { platform: "unknown", url: "https://example.com" },
    ]);
    expect(parseSocialPosts(value)).toHaveLength(1);
    expect(parseSocialPosts(value)[0]?.title).toBe("Lunch");
  });

  it("preserves the official Instagram post type", () => {
    expect(createSocialPost("instagram", "https://www.instagram.com/p/ABCdef123/")?.embedUrl).toBe(
      "https://www.instagram.com/p/ABCdef123/embed/",
    );
  });

  it("uses only validated official profile hosts", () => {
    const profiles = createSocialProfiles({
      VITE_SOCIAL_FACEBOOK_URL: "https://www.facebook.com/cafe1stalbans",
      VITE_SOCIAL_INSTAGRAM_URL: "https://evil.example/cafe1",
    });
    expect(profiles.map((item) => item.platform)).toEqual(["facebook", "tiktok"]);
    expect(findSocialProfile(profiles, "facebook")?.label).toBe("Facebook");
    expect(findSocialProfile(profiles, "youtube")).toBeNull();
  });

  it("creates validated profile embeds without accepting lookalike hosts", () => {
    expect(tiktokCreatorHandle("https://www.tiktok.com/@Cafe1_Stalbans")).toBe("Cafe1_Stalbans");
    expect(tiktokCreatorEmbedUrl("https://www.tiktok.com/@Cafe1_Stalbans")).toContain(
      "www.tiktok.com/embed/@Cafe1_Stalbans",
    );
    expect(tiktokCreatorHandle("https://tiktok.example/@Cafe1_Stalbans")).toBeNull();
    expect(tiktokCreatorEmbedUrl("https://tiktok.example/@Cafe1_Stalbans")).toBeNull();
    expect(facebookPagePluginUrl("https://www.facebook.com/cafe1stalbans")).toContain(
      "facebook.com%2Fcafe1stalbans",
    );
    expect(facebookPagePluginUrl("https://facebook.example/cafe1stalbans")).toBeNull();
  });

  it("combines automatic and manual posts without duplicates", () => {
    const post = createSocialPost("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const second = createSocialPost("instagram", "https://www.instagram.com/reel/ABCdef123/");
    expect(post).not.toBeNull();
    expect(second).not.toBeNull();
    expect(mergeSocialPosts([post!], [post!, second!])).toEqual([post, second]);
  });
});
