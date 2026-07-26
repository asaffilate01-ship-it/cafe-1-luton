import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bike, Coffee, Croissant, MapPin } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { PromoBanner } from "@/components/promo-banner";
import { PromoCarousel } from "@/components/promo-carousel";
import { StoreStatus } from "@/components/store-status";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cafe1 — Freshly brewed, delivered fast" },
      { name: "description", content: "Order coffee, breakfast and sandwiches from Cafe1. Delivery, collection or dine-in — pay securely with SumUp." },
      { property: "og:title", content: "Cafe1 — Freshly brewed, delivered fast" },
      { property: "og:description", content: "Order coffee, breakfast and sandwiches from Cafe1." },
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
              Freshly brewed.
              <br />
              <span className="text-primary">Delivered fast.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Cafe1 serves proper coffee, all-day breakfast and generous sandwiches. Order for delivery, collection or dine-in — pay in seconds with SumUp.
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
              <div className="flex items-center gap-2"><Bike className="h-4 w-4 text-primary" /> Local delivery</div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Cafe 1, St Albans Crown Court, AL1 3JW</div>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-square rounded-[2rem] bg-hero shadow-brand-lg" />
            <div className="absolute -bottom-6 -left-6 hidden max-w-xs rounded-2xl border border-border bg-card p-5 shadow-brand sm:block">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary">
                  <Coffee className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Barista pick</p>
                  <p className="font-semibold">Flat White · £3.60</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-4 top-8 hidden rounded-2xl border border-border bg-card p-4 shadow-brand sm:block">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Live orders</p>
              <p className="font-display text-2xl font-bold text-primary">27 today</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-soft">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-3">
          {[
            { icon: Coffee, title: "Speciality coffee", body: "House blend roasted weekly. Silky milk, sharp espresso, honest prices." },
            { icon: Croissant, title: "Made fresh daily", body: "Pastries baked in-house every morning. Sandwiches built to order." },
            { icon: Bike, title: "Fast delivery", body: "In-house drivers get your order to you hot — track it live from your phone." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold">{f.title}</h3>
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
