import { describe, expect, it } from "vitest";

import { absoluteUrl, articleJsonLd, breadcrumbJsonLd, safeJsonLd, seoMeta } from "../seo";

describe("SEO helpers", () => {
  it("creates canonical absolute URLs on the production origin", () => {
    expect(absoluteUrl("/breakfast-st-albans")).toBe(
      "https://cafe1stalbans.co.uk/breakfast-st-albans",
    );
    expect(absoluteUrl("menu")).toBe("https://cafe1stalbans.co.uk/menu");
  });

  it("emits complete crawl and social metadata", () => {
    const meta = seoMeta({
      title: "Halal Breakfast in St Albans | Café 1",
      description: "Fresh halal breakfast in St Albans.",
      path: "/breakfast-st-albans",
    });
    expect(meta).toContainEqual({
      name: "robots",
      content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    });
    expect(meta).toContainEqual({
      property: "og:url",
      content: "https://cafe1stalbans.co.uk/breakfast-st-albans",
    });
    expect(meta).toContainEqual({ name: "twitter:card", content: "summary_large_image" });
  });

  it("builds ordered breadcrumbs with absolute item URLs", () => {
    const data = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Breakfast in St Albans", path: "/breakfast-st-albans" },
    ]);
    expect(data.itemListElement[1]).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "Breakfast in St Albans",
      item: "https://cafe1stalbans.co.uk/breakfast-st-albans",
    });
  });

  it("marks the real Café 1 team as an organisation article author", () => {
    const data = articleJsonLd({
      title: "Lunch in St Albans",
      description: "A local lunch guide.",
      path: "/blog/lunch-in-st-albans",
      publishedAt: "2026-08-09T12:00:00Z",
      modifiedAt: "2026-08-09T12:00:00Z",
      author: "Café 1 St Albans team",
    });
    expect(data.author).toMatchObject({ "@type": "Organization" });
    expect(data.mainEntityOfPage).toMatchObject({
      "@id": "https://cafe1stalbans.co.uk/blog/lunch-in-st-albans",
    });
  });

  it("escapes opening angle brackets in JSON-LD script content", () => {
    expect(safeJsonLd({ value: "</script><script>" })).not.toContain("<");
  });
});
