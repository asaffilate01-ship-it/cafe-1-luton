import { describe, expect, it } from "vitest";

import {
  createSocialPost,
  createSocialProfiles,
  facebookPagePluginUrl,
  findSocialProfile,
  mergeSocialPosts,
  parseSocialPosts,
  tiktokCreatorHandle,
} from "../social-media";

describe("social media embed configuration", () => {
  it("creates privacy-enhanced YouTube and official TikTok players", () => {
    expect(
      createSocialPost("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.embedUrl,
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(
      createSocialPost("tiktok", "https://www.tiktok.com/@cafe1.luton/video/1234567890123456789")
        ?.embedUrl,
    ).toContain("www.tiktok.com/player/v1/1234567890123456789");
  });

  it("rejects untrusted or malformed sources", () => {
    expect(createSocialPost("youtube", "javascript:alert(1)")).toBeNull();
    expect(createSocialPost("instagram", "https://example.com/reel/not-cafe1")).toBeNull();
    expect(createSocialPost("tiktok", "https://www.tiktok.com/@cafe1.luton")).toBeNull();
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
      VITE_SOCIAL_FACEBOOK_URL: "https://www.facebook.com/cafe1luton",
      VITE_SOCIAL_INSTAGRAM_URL: "https://evil.example/cafe1",
    });
    expect(profiles.map((item) => item.platform)).toEqual(["facebook", "tiktok"]);
    expect(findSocialProfile(profiles, "facebook")?.label).toBe("Facebook");
    expect(findSocialProfile(profiles, "facebook")?.profileId).toBe("cafe1luton");
    expect(findSocialProfile(profiles, "tiktok")?.profileId).toBe("@cafe1.luton");
    expect(findSocialProfile(profiles, "youtube")).toBeNull();
  });

  it("uses the confirmed Café 1 social profile IDs", () => {
    const profiles = createSocialProfiles({});
    expect(findSocialProfile(profiles, "facebook")?.profileId).toBe("Cafe1luton");
    expect(findSocialProfile(profiles, "instagram")?.profileId).toBe("@cafe1luton");
    expect(findSocialProfile(profiles, "tiktok")?.profileId).toBe("@cafe1.luton");
  });

  it("creates validated profile embeds without accepting lookalike hosts", () => {
    expect(tiktokCreatorHandle("https://www.tiktok.com/@cafe1.luton")).toBe("cafe1.luton");
    expect(tiktokCreatorHandle("https://tiktok.example/@cafe1luton")).toBeNull();
    expect(facebookPagePluginUrl("https://www.facebook.com/cafe1luton")).toContain(
      "facebook.com%2Fcafe1luton",
    );
    expect(facebookPagePluginUrl("https://facebook.example/cafe1luton")).toBeNull();
  });

  it("combines automatic and manual posts without duplicates", () => {
    const post = createSocialPost("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const second = createSocialPost("instagram", "https://www.instagram.com/reel/ABCdef123/");
    expect(post).not.toBeNull();
    expect(second).not.toBeNull();
    expect(mergeSocialPosts([post!], [post!, second!])).toEqual([post, second]);
  });
});
