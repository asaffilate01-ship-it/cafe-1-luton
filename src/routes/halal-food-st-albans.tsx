import { createFileRoute } from "@tanstack/react-router";

import heroImage from "@/assets/cafe1-hero.webp";
import { LocalSearchPage } from "@/components/local-search-page";
import { config } from "@/lib/local-pages/halal-food-st-albans";
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

const path = "/halal-food-st-albans";
const title = "Halal Food in St Albans | Breakfast & Lunch | Café 1";
const description =
  "Find halal food in St Albans at Café 1: all-day breakfast, Desi dishes, sandwiches, curries and café lunches. Open weekdays at Crown Court, AL1 3JU.";

export const Route = createFileRoute("/halal-food-st-albans")({
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
          about: ["Halal food in St Albans", "Halal café", "Halal lunch"],
        }),
      ),
      jsonLdScript(faqJsonLd(config.faqs)),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Halal food in St Albans", path },
        ]),
      ),
    ],
  }),
  component: HalalFoodStAlbans,
});

function HalalFoodStAlbans() {
  return <LocalSearchPage config={config} />;
}
