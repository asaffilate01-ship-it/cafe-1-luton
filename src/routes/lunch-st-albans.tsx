import { createFileRoute } from "@tanstack/react-router";

import heroImage from "@/assets/cafe1-hero.webp";
import { LocalSearchPage } from "@/components/local-search-page";
import { config } from "@/lib/local-pages/lunch-st-albans";
import { localBusinessJsonLd } from "@/lib/nap";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  canonicalLink,
  faqJsonLd,
  jsonLdScript,
  seoMeta,
  webPageJsonLd,
} from "@/lib/seo";

const path = "/lunch-st-albans";
const title = "Lunch in St Albans | Halal Café Food | Café 1";
const description =
  "Order lunch in St Albans from Café 1: halal curries, sandwiches, paninis, wraps, salads and all-day breakfast. Dine in, collect or get local delivery.";

export const Route = createFileRoute("/lunch-st-albans")({
  head: () => ({
    meta: seoMeta({ title, description, path, image: heroImage }),
    links: [canonicalLink(path), { rel: "preload", as: "image", href: heroImage }],
    scripts: [
      jsonLdScript(localBusinessJsonLd(absoluteUrl(heroImage))),
      jsonLdScript(
        webPageJsonLd({
          name: title,
          description,
          path,
          about: ["Lunch in St Albans", "Halal lunch", "Café lunch"],
        }),
      ),
      jsonLdScript(faqJsonLd(config.faqs)),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Lunch in St Albans", path },
        ]),
      ),
    ],
  }),
  component: LunchStAlbans,
});

function LunchStAlbans() {
  return <LocalSearchPage config={config} />;
}
