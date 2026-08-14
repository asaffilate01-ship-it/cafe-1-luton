import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Bike,
  Clock3,
  Gift,
  Percent,
  ReceiptText,
  Smartphone,
  Store,
  Wallet,
  X,
  Check,
} from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { InstallAppButton } from "@/components/install-app-button";
import heroImage from "@/assets/cafe1-hero.webp";
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

const path = "/order-direct";
const title = "Order Direct from Café 1 St Albans | No App Fees";
const description =
  "Order direct from Café 1 St Albans and skip third-party app fees: counter prices, loyalty points, live delivery tracking, tabs and card, Apple Pay or Google Pay checkout.";

const faqs = [
  {
    question: "Why order direct from Café 1 instead of a delivery app?",
    answer:
      "Ordering on cafe1stalbans.co.uk uses our own kitchen system, so you pay café prices without third-party service or app fees, and every order supports the café directly rather than an aggregator's commission.",
  },
  {
    question: "Is ordering direct cheaper?",
    answer:
      "Our online menu uses the same prices as the counter, and we do not add aggregator service fees. Any delivery charge is shown clearly at checkout before you pay.",
  },
  {
    question: "How do I pay when ordering direct?",
    answer:
      "Checkout takes card payments through SumUp, including Apple Pay and Google Pay on supported devices. Court staff and approved house accounts can also charge to a tab and settle later.",
  },
  {
    question: "Can I track my delivery?",
    answer:
      "Yes. Local deliveries within half a mile of the café include live driver tracking on your order page, plus status updates as the kitchen prepares and sends the order.",
  },
  {
    question: "Do I need to install an app?",
    answer:
      "No. The website works in any browser, but you can install it to your home screen for one-tap ordering, saved baskets and order notifications.",
  },
];

export const Route = createFileRoute("/order-direct")({
  head: () => ({
    meta: seoMeta({ title, description, path, image: heroImage }),
    links: [canonicalLink(path)],
    scripts: [
      jsonLdScript(localBusinessJsonLd(absoluteUrl(heroImage))),
      jsonLdScript(
        webPageJsonLd({
          name: title,
          description,
          path,
          about: ["Order food direct in St Albans", "Halal takeaway St Albans", "No app fees"],
        }),
      ),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Order direct", path },
        ]),
      ),
      jsonLdScript(faqJsonLd(faqs)),
    ],
  }),
  component: OrderDirect,
});

const benefits = [
  {
    icon: Percent,
    title: "Counter prices, no app fees",
    body: "The online menu mirrors the price on the counter board. No aggregator service fee, no inflated item pricing.",
  },
  {
    icon: Gift,
    title: "Loyalty that actually pays",
    body: "Every direct order collects points towards money off. Third-party apps do not earn you anything with us.",
  },
  {
    icon: Bike,
    title: "Live tracking, our own drivers",
    body: "Local deliveries are run by Café 1, so you watch the real driver on the map instead of guessing.",
  },
  {
    icon: Clock3,
    title: "Order ahead to the minute",
    body: "Choose ASAP or a time slot, and collect without queueing when your break is short.",
  },
  {
    icon: ReceiptText,
    title: "Tabs and house accounts",
    body: "Court staff, chambers and approved businesses can charge to a tab and settle on one weekly statement.",
  },
  {
    icon: Wallet,
    title: "Pay how you like",
    body: "Card, Apple Pay and Google Pay through SumUp, or pay at the counter where your order type allows it.",
  },
];

const comparison = [
  { label: "Menu price", direct: "Same as the counter", apps: "Often marked up" },
  { label: "Service fee", direct: "None", apps: "Added per order" },
  { label: "Loyalty points", direct: "Earned on every order", apps: "Not available" },
  { label: "Live driver map", direct: "Yes, our own driver", apps: "Varies" },
  { label: "Scheduled collection", direct: "Choose your slot", apps: "Limited" },
  { label: "Tabs and weekly invoices", direct: "Supported", apps: "Not supported" },
  { label: "Who gets the money", direct: "The café", apps: "Commission to the platform" },
];

const steps = [
  { icon: Smartphone, title: "Browse the live menu", body: "Real-time availability, allergen notes and photos." },
  { icon: Store, title: "Pick how you want it", body: "Dine in, collect or local delivery, ASAP or a set time." },
  { icon: Wallet, title: "Pay in a tap", body: "Card, Apple Pay or Google Pay — or charge it to your tab." },
  { icon: BadgeCheck, title: "Track to the door", body: "Kitchen updates and live driver tracking until it lands." },
];

function OrderDirect() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border bg-secondary/45">
          <div className="pointer-events-none absolute -left-28 top-10 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1fr_0.86fr] lg:items-center lg:py-20">
            <div className="relative z-10">
              <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
                <ol className="flex flex-wrap items-center gap-2">
                  <li>
                    <a href="/" className="hover:text-primary">
                      Home
                    </a>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page" className="font-medium text-foreground">
                    Order direct
                  </li>
                </ol>
              </nav>
              <p className="mt-7 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                Order direct
              </p>
              <h1 className="mt-3 max-w-3xl font-display text-5xl font-bold leading-[0.98] sm:text-6xl">
                Same food. Café prices.
                <br />
                <span className="text-primary">None of the app fees.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Café 1 runs its own ordering, kitchen and delivery. Order here and you get counter
                pricing, loyalty points, live tracking and a receipt that supports the café instead
                of a delivery platform's commission.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/menu"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover"
                >
                  Order now <ArrowRight className="h-4 w-4" />
                </Link>
                <InstallAppButton
                  manifest="/manifest.webmanifest"
                  label="Install the app"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-6 font-semibold hover:border-primary hover:text-primary"
                />
              </div>
              <div className="mt-8 flex flex-wrap gap-5 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" /> 100% halal
                </span>
                <span className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" /> Open to the public
                </span>
                <span className="flex items-center gap-2">
                  <Bike className="h-4 w-4 text-primary" /> Local delivery within half a mile
                </span>
              </div>
            </div>
            <div className="relative">
              <img
                src={heroImage}
                alt="Café 1 St Albans food ready for collection and local delivery"
                width={1200}
                height={960}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="aspect-square w-full rounded-[2rem] object-cover shadow-brand-lg"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="direct-benefits">
          <h2 id="direct-benefits" className="font-display text-4xl font-bold">
            What you get by ordering here
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="card-3d card-3d-hover p-6">
                <span className="icon-3d h-14 w-14">
                  <benefit.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{benefit.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-soft" aria-labelledby="direct-comparison">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 id="direct-comparison" className="font-display text-4xl font-bold">
              Direct vs delivery apps
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              An honest side-by-side of how ordering on this site compares with ordering the same
              food through a third-party marketplace.
            </p>
            <div className="card-3d mt-8 overflow-hidden p-0">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">
                  Comparison of ordering direct from Café 1 versus third-party delivery apps
                </caption>
                <thead>
                  <tr className="bg-primary/10">
                    <th scope="col" className="px-4 py-3 font-semibold">
                      &nbsp;
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-primary">
                      Café 1 direct
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-muted-foreground">
                      Delivery apps
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.label} className="border-t border-border">
                      <th scope="row" className="px-4 py-3 font-medium">
                        {row.label}
                      </th>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                          {row.direct}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <X className="h-4 w-4 shrink-0" />
                          {row.apps}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="direct-steps">
          <h2 id="direct-steps" className="font-display text-4xl font-bold">
            Ordering takes about a minute
          </h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="card-3d card-3d-hover p-6">
                <span className="icon-3d-soft flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Step {index + 1}
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-border bg-soft" aria-labelledby="direct-faqs">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <h2 id="direct-faqs" className="font-display text-4xl font-bold">
              Questions before you order
            </h2>
            <dl className="mt-8 space-y-4">
              {faqs.map((faq) => (
                <div key={faq.question} className="card-3d p-6">
                  <dt className="font-display text-lg font-semibold">{faq.question}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="card-3d mt-10 p-8 text-center">
              <h2 className="font-display text-3xl font-bold">Ready when you are.</h2>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                Browse the live menu, choose dine in, collection or delivery, and pay in a tap.
              </p>
              <Link
                to="/menu"
                className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover"
              >
                Start your order <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
