import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bike, Coffee, Croissant, MapPin, BadgeCheck, UtensilsCrossed } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { PromoBanner } from "@/components/promo-banner";
import { PromoCarousel } from "@/components/promo-carousel";
import { StoreStatus } from "@/components/store-status";
import heroImage from "@/assets/cafe1-hero.jpg.asset.json";
import { localBusinessJsonLd } from "@/lib/nap";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Café 1 St Albans — Coffee & Food, Delivered" },
      { name: "description", content: "Order coffee, breakfast and hot food from Café 1 at St Albans Crown Court. Open to the public, with free delivery within half a mile, collection or dine-in." },
      { property: "og:title", content: "Café 1 St Albans — Coffee & Food, Delivered" },
      { property: "og:description", content: "Order coffee, breakfast and hot food from Café 1 at St Albans Crown Court. Open to the public, with free delivery within half a mile, collection or dine-in." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cafe1stalbans.co.uk/" },
      { property: "og:image", content: `https://cafe1stalbans.co.uk${heroImage.url}` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `https://cafe1stalbans.co.uk${heroImage.url}` },
    ],
    links: [
      { rel: "canonical", href: "https://cafe1stalbans.co.uk/" },
      { rel: "preload", as: "image", href: heroImage.url, fetchPriority: "high" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          localBusinessJsonLd(`https://cafe1stalbans.co.uk${heroImage.url}`),
        ),
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <PromoBanner />
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <PromoCarousel />
      </div>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <StoreStatus />
            <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] sm:text-6xl">
              British Classics. Desi Favourites.
              <br />
              <span className="text-primary">One Great Menu.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Enjoy all-day breakfasts, hot meals, paninis, parathas, cakes, coffees and more from Café 1 at St Albans Crown Court. Open to the public — everyone welcome.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/menu" className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover">
                Order now <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/menu" className="inline-flex h-12 items-center rounded-full border border-border bg-card px-6 font-semibold hover:border-primary hover:text-primary">
                View menu
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" /> All food is halal</div>
              <div className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" /> Open to the public</div>
              <div className="flex items-center gap-2"><Bike className="h-4 w-4 text-primary" /> Local delivery</div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Cafe 1, St Albans Crown Court, AL1 3JU</div>
            </div>
          </div>

          <div className="relative">
            <img
              src={heroImage.url}
              alt="Café 1 spread: full English breakfast, fish and chips, jacket potato, loaded fries and a mug of tea"
              width={1024}
              height={1024}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="aspect-square w-full rounded-[2rem] object-cover shadow-brand-lg"
            />
            <div className="card-3d absolute -bottom-6 -left-6 hidden max-w-xs p-5 sm:block">
              <div className="flex items-center gap-3">
                <span className="icon-3d h-11 w-11">
                  <UtensilsCrossed className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Customer favourite</p>
                  <p className="font-semibold">Full Desi Breakfast · £9.99</p>
                </div>
              </div>
            </div>
            <div className="card-3d absolute -right-4 top-8 hidden p-4 sm:block">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Ready in</p>
              <p className="font-display text-2xl font-bold text-primary">~20 min</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-soft">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Coffee, title: "Fresh Italian coffee", body: "Freshly ground Italian beans, silky milk and sharp espresso — honest prices." },
            { icon: BadgeCheck, title: "100% halal", body: "All meat and food served at Café 1 is halal." },
            { icon: Croissant, title: "Made fresh daily", body: "Fresh desi food cooked to order, alongside paninis, jackets and all-day breakfasts." },
            { icon: Bike, title: "Fast delivery", body: "In-house drivers get your order to you hot — track it live from your phone." },
          ].map((f) => (
            <div key={f.title} className="card-3d card-3d-hover p-6">
              <span className="icon-3d h-14 w-14">
                <f.icon className="h-6 w-6" />
              </span>
              <h2 className="mt-5 font-display text-xl font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="font-display text-4xl font-bold">Hungry?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Browse the menu, drop things in your basket, pay in a tap.</p>
        <Link to="/menu" className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover">
          Start your order <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}
