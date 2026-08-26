import { createFileRoute } from "@tanstack/react-router";

import heroImage from "@/assets/cafe1-hero.webp";
import { LocalSearchPage } from "@/components/local-search-page";
import { config } from "@/lib/local-pages/breakfast-luton";
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

const path = "/breakfast-luton";
const title = "Breakfast in Luton | Halal & All Day | Café 1";
const description =
  "Enjoy halal breakfast in Luton: breakfast plates, Desi breakfast, parathas and omelettes at Luton Crown Court or Futures House, Marsh Farm.";

export const Route = createFileRoute("/breakfast-luton")({
  head: () => ({
    meta: seoMeta({
      title,
      description,
      path,
      keywords: [
        "halal full English breakfast Luton",
        "Desi breakfast Luton",
        "breakfast Marsh Farm",
        "breakfast near Luton Crown Court",
        "paratha breakfast Luton",
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
          about: ["Breakfast in Luton", "Halal breakfast", "Desi breakfast"],
        }),
      ),
      jsonLdScript(faqJsonLd(config.faqs)),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Breakfast in Luton", path },
        ]),
      ),
    ],
  }),
  component: BreakfastLuton,
});

function BreakfastLuton() {
  return <LocalSearchPage config={config} />;
}
