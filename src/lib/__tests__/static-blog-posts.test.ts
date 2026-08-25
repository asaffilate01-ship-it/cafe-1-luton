import { describe, expect, it } from "vitest";

import {
  getStaticBlogPost,
  mergeBlogPostSummaries,
  STATIC_BLOG_POSTS,
  STATIC_BLOG_POST_SUMMARIES,
} from "../static-blog-posts";

describe("built-in Luton blog articles", () => {
  it("publishes unique, Luton-only articles with social images", () => {
    expect(STATIC_BLOG_POSTS).toHaveLength(9);
    expect(new Set(STATIC_BLOG_POSTS.map((post) => post.slug)).size).toBe(9);

    for (const post of STATIC_BLOG_POSTS) {
      expect(post.published).toBe(true);
      expect(post.cover_url).toMatch(/^\/blog\/[a-z0-9-]+\.jpg$/);
      expect(`${post.title} ${post.excerpt} ${post.body_md}`.toLowerCase()).not.toContain(
        ["st", "albans"].join(" "),
      );
    }
  });

  it("keeps the built-in corrected article when Supabase has a duplicate slug", () => {
    const builtIn = getStaticBlogPost("halal-breakfast-luton");
    expect(builtIn?.title).toContain("Halal Breakfast in Luton");

    const merged = mergeBlogPostSummaries([
      {
        ...STATIC_BLOG_POST_SUMMARIES[0],
        slug: "halal-breakfast-luton",
        title: "Old database copy",
      },
    ]);

    expect(merged.find((post) => post.slug === "halal-breakfast-luton")?.title).toBe(
      builtIn?.title,
    );
  });
});
