import { NAP } from "./nap";

export const SITE_URL = NAP.url;
export const SITE_NAME = NAP.name;
export const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/og-cafe1-luton.jpg`;
export const DEFAULT_SEO_KEYWORDS = [
  "Café 1 Luton",
  "cafe in Luton",
  "halal cafe Luton",
  "halal breakfast Luton",
  "all day breakfast Luton",
  "breakfast in Luton",
  "lunch in Luton",
  "halal food Luton",
  "coffee shop Luton",
  "Luton Crown Court cafe",
  "cafe near Luton Crown Court",
  "Futures House cafe",
  "Marsh Farm cafe",
  "takeaway Luton",
  "Desi breakfast Luton",
];

type SeoMetaInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
  keywords?: string[];
  type?: "website" | "article";
  robots?: string;
};

export function absoluteUrl(path = "/"): string {
  if (/^https:\/\//i.test(path)) return path;
  return new URL(path.startsWith("/") ? path : `/${path}`, SITE_URL).toString();
}

export function seoMeta({
  title,
  description,
  path,
  image = DEFAULT_SOCIAL_IMAGE,
  imageAlt = `${SITE_NAME} food and drink`,
  keywords = [],
  type = "website",
  robots = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
}: SeoMetaInput): Array<Record<string, string>> {
  const canonical = absoluteUrl(path);
  const socialImage = absoluteUrl(image);
  const keywordContent = [...new Set([...keywords, ...DEFAULT_SEO_KEYWORDS])].join(", ");
  const lowerImage = socialImage.toLowerCase();
  const imageType = lowerImage.includes(".png")
    ? "image/png"
    : lowerImage.includes(".webp")
      ? "image/webp"
      : "image/jpeg";
  return [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: keywordContent },
    { name: "robots", content: robots },
    { name: "googlebot", content: robots },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "en_GB" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: canonical },
    { property: "og:image", content: socialImage },
    { property: "og:image:secure_url", content: socialImage },
    { property: "og:image:type", content: imageType },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: imageAlt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: socialImage },
    { name: "twitter:image:alt", content: imageAlt },
  ];
}

export function canonicalLink(path: string) {
  return { rel: "canonical", href: absoluteUrl(path) };
}

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function jsonLdScript(value: unknown) {
  return { type: "application/ld+json", children: safeJsonLd(value) };
}

export type BreadcrumbItem = { name: string; path: string };

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function webPageJsonLd(input: {
  name: string;
  description: string;
  path: string;
  about?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${absoluteUrl(input.path)}#webpage`,
    url: absoluteUrl(input.path),
    name: input.name,
    description: input.description,
    inLanguage: "en-GB",
    about: input.about?.map((name) => ({ "@type": "Thing", name })),
    isPartOf: { "@id": `${SITE_URL}/#website` },
    primaryImageOfPage: { "@id": `${DEFAULT_SOCIAL_IMAGE}#primaryimage` },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    inLanguage: "en-GB",
    publisher: { "@id": `${SITE_URL}/#localbusiness` },
  };
}

/** Rich-result markup for a page that answers questions inline. */
export function faqJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function articleJsonLd(input: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  publishedAt: string;
  modifiedAt: string;
  author?: string | null;
}) {
  const url = absoluteUrl(input.path);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: input.title,
    description: input.description,
    image: absoluteUrl(input.image || DEFAULT_SOCIAL_IMAGE),
    datePublished: input.publishedAt,
    dateModified: input.modifiedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: {
      "@type": "Organization",
      name: input.author || `${SITE_NAME} team`,
      url: `${SITE_URL}/about`,
    },
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#localbusiness`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` },
    },
    inLanguage: "en-GB",
  };
}
