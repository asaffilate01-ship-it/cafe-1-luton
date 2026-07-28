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
          Cafe1 opened at St Albans Crown Court, AL1 3JW with one simple idea: proper coffee and honest food, served fast. We roast the same blend we've poured since day one, bake our pastries in-house every morning, and put every order together as if it were our own.
        </p>
        <p className="mt-4 text-lg text-muted-foreground">
          Whether you dine in, collect on your way to work, or have one of our drivers bring it to your door — thanks for choosing us.
        </p>
      </div>
      <SiteFooter />
    </div>
  );
}