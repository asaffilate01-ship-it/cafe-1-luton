import { describe, expect, it } from "vitest";

import { absoluteUrl, articleJsonLd, breadcrumbJsonLd, safeJsonLd, seoMeta } from "../seo";

describe("SEO helpers", () => {
  it("creates canonical absolute URLs on the production origin", () => {
    expect(absoluteUrl("/breakfast-luton")).toBe("https://cafe1luton.co.uk/breakfast-luton");
    expect(absoluteUrl("menu")).toBe("https://cafe1luton.co.uk/menu");
  });

  it("emits complete crawl and social metadata", () => {
    const meta = seoMeta({
      title: "Halal Breakfast in Luton | Café 1",
      description: "Fresh halal breakfast in Luton.",
      path: "/breakfast-luton",
    });
    expect(meta).toContainEqual({
      name: "robots",
      content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    });
    expect(meta).toContainEqual({
      property: "og:url",
      content: "https://cafe1luton.co.uk/breakfast-luton",
    });
    expect(meta).toContainEqual({ name: "twitter:card", content: "summary_large_image" });
    expect(meta).toContainEqual({ property: "og:image:width", content: "1200" });
    expect(meta).toContainEqual({ property: "og:image:height", content: "630" });
    expect(meta.find((item) => item.name === "keywords")?.content).toContain("halal cafe Luton");
  });

  it("builds ordered breadcrumbs with absolute item URLs", () => {
    const data = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Breakfast in Luton", path: "/breakfast-luton" },
    ]);
    expect(data.itemListElement[1]).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "Breakfast in Luton",
      item: "https://cafe1luton.co.uk/breakfast-luton",
    });
  });

  it("marks the real Café 1 team as an organisation article author", () => {
    const data = articleJsonLd({
      title: "Lunch in Luton",
      description: "A local lunch guide.",
      path: "/blog/lunch-in-luton",
      publishedAt: "2026-08-09T12:00:00Z",
      modifiedAt: "2026-08-09T12:00:00Z",
      author: "Café 1 Luton team",
    });
    expect(data.author).toMatchObject({ "@type": "Organization" });
    expect(data.mainEntityOfPage).toMatchObject({
      "@id": "https://cafe1luton.co.uk/blog/lunch-in-luton",
    });
  });

  it("escapes opening angle brackets in JSON-LD script content", () => {
    expect(safeJsonLd({ value: "</script><script>" })).not.toContain("<");
  });
});
