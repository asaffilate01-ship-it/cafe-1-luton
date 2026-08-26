import { createFileRoute } from "@tanstack/react-router";

import heroImage from "@/assets/cafe1-hero.webp";
import { LocalSearchPage } from "@/components/local-search-page";
import { config } from "@/lib/local-pages/halal-food-luton";
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

const path = "/halal-food-luton";
const title = "Halal Food in Luton | Breakfast & Lunch | Café 1";
const description =
  "Find halal food in Luton at Café 1: all-day breakfast, Desi dishes, sandwiches, curries and café lunches at Crown Court or Futures House.";

export const Route = createFileRoute("/halal-food-luton")({
  head: () => ({
    meta: seoMeta({
      title,
      description,
      path,
      keywords: [
        "100% halal cafe Luton",
        "halal lunch Luton",
        "halal food Marsh Farm",
        "halal cafe near Luton town centre",
        "halal Desi breakfast Luton",
      ],
    }),
    links: [canonicalLink(path), { rel: "preload", as: "image", href: heroImage }],
    scripts: [
      jsonLdScript(localBusinessJsonLd(absoluteUrl(heroImage))),
      jsonLdScript(
        webPageJsonLd({
          name: title,
          description,
          path,
          about: ["Halal food in Luton", "Halal café", "Halal lunch"],
        }),
      ),
      jsonLdScript(faqJsonLd(config.faqs)),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Halal food in Luton", path },
        ]),
      ),
    ],
  }),
  component: HalalFoodLuton,
});

function HalalFoodLuton() {
  return <LocalSearchPage config={config} />;
}
