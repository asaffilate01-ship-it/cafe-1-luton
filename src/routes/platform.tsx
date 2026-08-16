import { createFileRoute, Link } from "@tanstack/react-router";
import { PlatformShell } from "@/components/platform-layout";
import heroImage from "@/assets/platform-hero.jpg";
import {
  ArrowRight,
  BarChart3,
  Bike,
  Check,
  ChefHat,
  Cookie,
  CreditCard,
  FileCheck,
  Globe2,
  Lock,
  Mail,
  MonitorSmartphone,
  Package,
  Phone,
  QrCode,
  Receipt,
  Server,
  Sparkles,
  ShieldCheck,
  Ticket,
  Truck,
  Users,
} from "lucide-react";

const title = "Hospitality ordering platform for independent venues | Cafe 1 Platform";
const description =
  "One white-label platform for cafés and restaurants: branded website, direct ordering, kitchen display, EPOS, delivery driver app, voucher and code schemes, plus full financial reporting.";

export const Route = createFileRoute("/platform")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlatformHome,
});

const services = [
  {
    Icon: Globe2,
    title: "Branded website & SEO",
    text: "Fast, mobile-first marketing site with local SEO pages, blog, structured data, sitemap and social feeds — built per venue, not a template page.",
  },
  {
    Icon: MonitorSmartphone,
    title: "Direct ordering app (PWA)",
    text: "Dine-in, collection and delivery with time slots, live menu search, allergen info, saved baskets and installable app on iOS and Android.",
  },
  {
    Icon: ChefHat,
    title: "Kitchen Display System",
    text: "Colour-coded KDS by channel and fulfilment type, cooked/not-cooked banners, area moves, audible alerts and dual ticket printing.",
  },
  {
    Icon: CreditCard,
    title: "EPOS & card payments",
    text: "Till app with SumUp Solo card reader, cash drawer, customer display, receipt printing and online card checkout — one ledger for every channel.",
  },
  {
    Icon: Ticket,
    title: "Vouchers & code schemes",
    text: "Built-in voucher issuing, gated access codes, single-use redemption, automatic email-based discounts and secure server-side promo validation.",
  },
  {
    Icon: Bike,
    title: "Driver app & live tracking",
    text: "Assign or claim jobs, turn-by-turn routing, live map tracking for customers and automatic status notifications end to end.",
  },
  {
    Icon: BarChart3,
    title: "Financials & reporting",
    text: "Sales, gross margin, food cost, expenses, supplier invoices, payment mix, settlement imports and daily P&L snapshots.",
  },
  {
    Icon: Package,
    title: "Stock & suppliers",
    text: "Inventory items, purchase receipts, waste and staff-meal tracking, low-stock alerts and cost-price control per recipe line.",
  },
  {
    Icon: Users,
    title: "House accounts & tabs",
    text: "Company tabs with credit limits, weekly billing runs, statements and MFA-protected account management.",
  },
  {
    Icon: Truck,
    title: "Marketplace integrations",
    text: "Deliveroo and Just Eat orders pulled into the same KDS and reports, so every channel is visible in one place.",
  },
  {
    Icon: QrCode,
    title: "QR & on-site journeys",
    text: "Table and counter QR ordering, gated menus for specific groups, attendance codes and printable signage.",
  },
  {
    Icon: ShieldCheck,
    title: "Security & compliance",
    text: "Role-based access, row-level database security, audit trails, GDPR-safe data handling, cookie consent and MFA for sensitive areas.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "£99",
    blurb: "Single site getting off the marketplaces.",
    items: ["Branded website & SEO", "Direct ordering + card payments", "KDS with ticket printing", "Email support"],
  },
  {
    name: "Growth",
    price: "£199",
    blurb: "Busy venues running delivery and tabs.",
    items: ["Everything in Starter", "EPOS till, drawer & customer display", "Driver app + live tracking", "Vouchers, promos & house accounts"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Talk to us",
    blurb: "Multi-site groups and bespoke workflows.",
    items: ["Everything in Growth", "Multi-site reporting & rollups", "Marketplace integrations", "Custom features & priority SLA"],
  },
];

const steps = [
  { n: "01", title: "Discovery", text: "We map your menu, opening hours, service types, delivery radius and pricing rules." },
  { n: "02", title: "Build & brand", text: "Your own deployment, colours, logo, domain and content — live in days, not months." },
  { n: "03", title: "Hardware & payments", text: "Card reader, printers and drawer configured, payouts connected and tested end to end." },
  { n: "04", title: "Go live & support", text: "Staff training, launch checklist, monitoring and ongoing updates from one team." },
];

function PlatformHome() {
  return (
    <PlatformShell>
      <main>
        <section className="relative overflow-hidden border-b border-border bg-secondary/40">
          <div className="pointer-events-none absolute -left-24 top-6 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute -right-32 -top-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> White-label ordering for independents
            </p>
            <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-[3.4rem]">
              Everything a food business needs to sell direct — website, ordering, kitchen, till and books.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              We build and run the complete system behind Café 1 St Albans, and we clone it for your venue under your
              own brand and domain. No aggregator commission, no six suppliers to manage.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#contact"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30"
              >
                Get your venue live <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#services"
                className="inline-flex h-12 items-center rounded-full border border-border bg-card px-6 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary"
              >
                See what's included
              </a>
            </div>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-primary/10 blur-2xl" />
                <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-2xl shadow-primary/15">
                  <img
                    src={heroImage}
                    alt="Café counter with EPOS till, card reader and kitchen display screen in use during service"
                    width={1600}
                    height={1104}
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/85 to-transparent p-5">
                    <p className="font-display text-sm font-bold">Live at Café 1 St Albans</p>
                    <p className="text-xs text-muted-foreground">Web, app, KDS, till and drivers on one system</p>
                  </div>
                </div>
              </div>
            </div>
            <dl className="mt-14 grid gap-4 sm:grid-cols-3">
              {[
                ["0%", "commission on your own direct orders"],
                ["1 system", "web, app, KDS, EPOS, drivers and finance"],
                ["Days", "typical time from kick-off to going live"],
              ].map(([k, v]) => (
                <div key={v} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                  <dt className="font-display text-3xl font-bold text-primary">{k}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="services" className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <h2 className="font-display text-4xl font-bold">What we provide</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Every module below is already live in production — not a roadmap. Take the whole platform or the parts you
            need.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map(({ Icon, title: t, text }) => (
              <article
                key={t}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                <span className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/5 opacity-0 transition group-hover:opacity-100" />
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-sm transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <h3 className="mt-4 font-display text-xl font-bold">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
            <h2 className="font-display text-4xl font-bold">How it works</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s) => (
                <div
                  key={s.n}
                  className="relative rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/25">
                    {s.n}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <h2 className="font-display text-4xl font-bold">Simple monthly plans</h2>
          <p className="mt-3 text-muted-foreground">Per venue, billed monthly. Card processing is charged by your payment provider.</p>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-2xl border bg-card p-6 transition hover:-translate-y-1 hover:shadow-lg ${p.featured ? "border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20 lg:-mt-2 lg:pb-8" : "border-border shadow-sm"}`}
              >
                {p.featured ? (
                  <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Most popular
                  </span>
                ) : null}
                <h3 className="mt-3 font-display text-2xl font-bold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
                <p className="mt-4 font-display text-4xl font-bold">
                  {p.price}
                  {p.price.startsWith("£") ? <span className="text-base font-medium text-muted-foreground">/month</span> : null}
                </p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {p.items.map((i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className="text-muted-foreground">{i}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#contact"
                  className={`mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${p.featured ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:brightness-110" : "border border-border bg-card hover:border-primary/40 hover:text-primary"}`}
                >
                  Enquire <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </section>

        <section id="trust" className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
            <h2 className="font-display text-4xl font-bold">Built to be trusted</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Every part of the platform follows compliance-minded defaults: secure payments, transparent
              data handling, audit trails and accessibility from the start.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  Icon: Lock,
                  title: "Encrypted & secure",
                  text: "HTTPS in transit, role-based access, row-level database security and audit logs for sensitive changes.",
                },
                {
                  Icon: CreditCard,
                  title: "Payment-safe",
                  text: "Card payments are handled by SumUp. The platform never stores full card numbers, CVV or PIN data.",
                },
                {
                  Icon: Cookie,
                  title: "Cookie consent",
                  text: "Granular consent for analytics and marketing, with strictly-necessary storage only until a choice is made.",
                },
                {
                  Icon: FileCheck,
                  title: "GDPR-ready",
                  text: "Data request workflows, purpose limitation and clear privacy, terms and cookie policies for every tenant.",
                },
              ].map(({ Icon, title: t, text }) => (
                <article
                  key={t}
                  className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/platform/compliance"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                <Server className="h-4 w-4" /> Read full compliance details
              </Link>
              <Link
                to="/privacy"
                className="inline-flex h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-semibold"
              >
                Privacy policy
              </Link>
            </div>
          </div>
        </section>

        <section id="contact" className="border-t border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <h2 className="font-display text-4xl font-bold">Let's get your venue selling direct</h2>
                <p className="mt-3 max-w-xl text-muted-foreground">
                  Tell us about your site and we'll show you the live system running at Café 1 St Albans, then scope
                  your build.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="mailto:hello@cafe1stalbans.co.uk?subject=Platform%20demo%20request"
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
                  >
                    <Mail className="h-4 w-4" /> Email us
                  </a>
                  <a
                    href="tel:+441727000000"
                    className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-semibold"
                  >
                    <Phone className="h-4 w-4" /> Call us
                  </a>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h3 className="font-display text-xl font-bold">See it in the wild</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Café 1 St Albans runs the full stack every trading day: online ordering, KDS, EPOS, drivers, vouchers
                  and nightly financial reporting.
                </p>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {[
                    [Receipt, "Live orders across web, till and marketplaces"],
                    [ChefHat, "Kitchen tickets printed automatically"],
                    [BarChart3, "Daily P&L without spreadsheets"],
                  ].map(([I, label]) => {
                    const Ico = I as typeof Receipt;
                    return (
                      <li key={label as string} className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                          <Ico className="h-4 w-4" strokeWidth={1.9} />
                        </span>
                        {label as string}
                      </li>
                    );
                  })}
                </ul>
                <a
                  href="https://cafe1stalbans.co.uk"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                >
                  View the live venue site <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PlatformShell>
  );
}
