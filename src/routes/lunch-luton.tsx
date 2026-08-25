import { createFileRoute } from "@tanstack/react-router";

import heroImage from "@/assets/cafe1-hero.webp";
import { LocalSearchPage } from "@/components/local-search-page";
import { config } from "@/lib/local-pages/lunch-luton";
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

const path = "/lunch-luton";
const title = "Lunch in Luton | Halal Café Food | Café 1";
const description =
  "Order lunch in Luton from Café 1: halal curries, sandwiches, paninis, wraps, salads and all-day breakfast. Dine in or take away.";

export const Route = createFileRoute("/lunch-luton")({
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
          about: ["Lunch in Luton", "Halal lunch", "Café lunch"],
        }),
      ),
      jsonLdScript(faqJsonLd(config.faqs)),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Lunch in Luton", path },
        ]),
      ),
    ],
  }),
  component: LunchLuton,
});

function LunchLuton() {
  return <LocalSearchPage config={config} />;
}
