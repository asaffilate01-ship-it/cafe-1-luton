import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Café 1 St Albans — Our Story" },
      { name: "description", content: "Café 1 is an independent café at St Albans Crown Court serving fresh Italian coffee and 100% halal food, made to order every weekday." },
      { property: "og:title", content: "About Café 1 St Albans" },
      { property: "og:description", content: "An independent café at St Albans Crown Court serving Italian coffee and 100% halal food." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cafe1stalbans.co.uk/about" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://cafe1stalbans.co.uk/about" }],
  }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-5xl font-bold">Our story</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Cafe 1 has been proudly serving the Luton community since 2008, with two successful and popular locations. In May 2026, we opened our newest café at St Albans Crown Court, bringing our well-loved combination of good food, great value and friendly service to St Albans.
        </p>
        <p className="mt-4 text-lg text-muted-foreground">
          Open to court visitors, local workers, residents and the general public, Cafe 1 offers a welcoming atmosphere where everyone can enjoy freshly prepared food at affordable prices.
        </p>
        <p className="mt-4 text-lg text-muted-foreground">
          Whether you dine in, collect on the go or order for delivery, we look forward to welcoming you to Cafe 1.
        </p>
      </div>
      <SiteFooter />
    </div>
  );
}