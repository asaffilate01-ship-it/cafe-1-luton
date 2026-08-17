import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PlatformShell } from "@/components/platform-layout";
import heroImage from "@/assets/platform-hero.jpg";
import shotHome from "@/assets/platform/shot-home.webp.asset.json";
import shotMenu from "@/assets/platform/shot-menu.webp.asset.json";
import shotDirect from "@/assets/platform/shot-direct.webp.asset.json";
import shotMobile from "@/assets/platform/shot-mobile.webp.asset.json";
import { usePlatformI18n } from "@/components/platform-i18n-provider";
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

const title = "dishbee — Sell. Serve. Grow. | Ordering platform for independent venues";
const description =
  "dishbee is one white-label platform for cafés and restaurants: branded website, direct ordering, kitchen display, EPOS, delivery driver app, voucher and code schemes, plus full financial reporting.";

export const Route = createFileRoute("/platform")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://dishbee.co.uk/platform" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://dishbee.co.uk/platform" }],
  }),
  component: PlatformHome,
});

const serviceIcons = [
  Globe2,
  MonitorSmartphone,
  ChefHat,
  CreditCard,
  Ticket,
  Bike,
  BarChart3,
  Package,
  Users,
  Truck,
  QrCode,
  ShieldCheck,
];

const trustIcons = [Lock, CreditCard, Cookie, FileCheck];
const contactIcons = [Receipt, ChefHat, BarChart3];
const stepNumbers = ["01", "02", "03", "04"];
const planPrices = ["\u00a399", "\u00a3199", null] as const;
const shotSources = [shotHome.url, shotMenu.url, shotDirect.url];

function PlatformHome() {
  return (
    <PlatformShell>
      <PlatformContent />
    </PlatformShell>
  );
}

function PlatformContent() {
  const { t } = usePlatformI18n();
  useEffect(() => {
    document.title = t.hero.pageTitle;
  }, [t.hero.pageTitle]);
  return (
      <main>
        <section className="relative overflow-hidden border-b border-border bg-secondary/40">
          <div className="pointer-events-none absolute -left-24 top-6 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute -right-32 -top-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
                  <Sparkles className="h-3.5 w-3.5" /> {t.hero.badge}
                </p>
                <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-[3.4rem]">
                  {t.hero.h1}
                </h1>
                <p className="mt-6 max-w-2xl text-lg text-muted-foreground">{t.hero.lead}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="#contact"
                    className="group inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30"
                  >
                    {t.hero.ctaPrimary} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </a>
                  <a
                    href="#services"
                    className="inline-flex h-12 items-center rounded-full border border-border bg-card px-6 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary"
                  >
                    {t.hero.ctaSecondary}
                  </a>
                </div>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-primary/10 blur-2xl" />
                <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-2xl shadow-primary/15">
                  <img
                    src={heroImage}
                    alt={t.hero.imageAlt}
                    width={1600}
                    height={1104}
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/85 to-transparent p-5">
                    <p className="font-display text-sm font-bold">{t.hero.imageTitle}</p>
                    <p className="text-xs text-muted-foreground">{t.hero.imageSub}</p>
                  </div>
                </div>
              </div>
            </div>
            <dl className="mt-14 grid gap-4 sm:grid-cols-3">
              {t.hero.stats.map(([k, v]) => (
                <div key={v} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                  <dt className="font-display text-3xl font-bold text-primary">{k}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="services" className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t.services.eyebrow}</p>
          <h2 className="mt-2 font-display text-4xl font-bold">{t.services.heading}</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{t.services.lead}</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {t.services.items.map(([title, text], i) => {
              const Icon = serviceIcons[i] ?? Sparkles;
              return (
                <article
                  key={title}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                >
                  <span className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/5 opacity-0 transition group-hover:opacity-100" />
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-sm transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <h3 className="mt-4 font-display text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="tour" className="border-y border-border bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t.tour.eyebrow}</p>
            <h2 className="mt-2 font-display text-4xl font-bold">{t.tour.heading}</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">{t.tour.lead}</p>
            <div className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
              <div className="grid gap-6 sm:grid-cols-2">
                {t.tour.shots.map(([label, caption, alt], i) => (
                  <figure
                    key={label}
                    className={`group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl ${i === 0 ? "sm:col-span-2" : ""}`}
                  >
                    <div className="relative overflow-hidden border-b border-border/70 bg-secondary/50">
                      <div className="flex items-center gap-1.5 px-4 py-2.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                        <span className="h-2.5 w-2.5 rounded-full bg-primary/40" />
                        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                        <span className="ml-3 truncate rounded-full bg-background/80 px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
                          yourvenue.co.uk
                        </span>
                      </div>
                      <img
                        src={shotSources[i]}
                        alt={alt}
                        loading="lazy"
                        className="w-full origin-top object-cover object-top transition duration-500 group-hover:scale-[1.02]"
                      />
                    </div>
                    <figcaption className="p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{label}</p>
                      <p className="mt-1.5 text-sm text-muted-foreground">{caption}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <div className="relative mx-auto w-full max-w-[280px]">
                <div className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-primary/10 blur-2xl" />
                <div className="relative rounded-[2.25rem] border-[10px] border-foreground/85 bg-foreground/85 shadow-2xl shadow-primary/20">
                  <div className="overflow-hidden rounded-[1.5rem] bg-card">
                    <img
                      src={shotMobile.url}
                      alt={t.tour.mobileAlt}
                      loading="lazy"
                      className="w-full object-cover object-top"
                    />
                  </div>
                </div>
                <p className="mt-5 text-center text-sm text-muted-foreground">{t.tour.mobileCaption}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t.how.eyebrow}</p>
            <h2 className="mt-2 font-display text-4xl font-bold">{t.how.heading}</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {t.how.steps.map(([title, text], i) => (
                <div
                  key={title}
                  className="relative rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/25">
                    {stepNumbers[i]}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t.pricing.eyebrow}</p>
          <h2 className="mt-2 font-display text-4xl font-bold">{t.pricing.heading}</h2>
          <p className="mt-3 text-muted-foreground">{t.pricing.lead}</p>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {t.pricing.plans.map((p, i) => {
              const price = planPrices[i];
              const featured = i === 1;
              return (
                <div
                  key={p.name}
                  className={`relative flex flex-col rounded-2xl border bg-card p-6 transition hover:-translate-y-1 hover:shadow-lg ${featured ? "border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20 lg:-mt-2 lg:pb-8" : "border-border shadow-sm"}`}
                >
                  {featured ? (
                    <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      {t.pricing.popular}
                    </span>
                  ) : null}
                  <h3 className="mt-3 font-display text-2xl font-bold">{p.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
                  <p className="mt-4 font-display text-4xl font-bold">
                    {price ?? t.pricing.talkToUs}
                    {price ? <span className="text-base font-medium text-muted-foreground">{t.pricing.perMonth}</span> : null}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                    {p.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#contact"
                    className={`mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${featured ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:brightness-110" : "border border-border bg-card hover:border-primary/40 hover:text-primary"}`}
                  >
                    {t.pricing.enquire} <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              );
            })}
          </div>
        </section>

        <section id="trust" className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t.trust.eyebrow}</p>
            <h2 className="mt-2 font-display text-4xl font-bold">{t.trust.heading}</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">{t.trust.lead}</p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {t.trust.items.map(([title, text], i) => {
                const Icon = trustIcons[i] ?? ShieldCheck;
                return (
                  <article
                    key={title}
                    className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-5 w-5" strokeWidth={1.9} />
                    </span>
                    <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </article>
                );
              })}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/platform/compliance"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                <Server className="h-4 w-4" /> {t.trust.ctaCompliance}
              </Link>
              <Link
                to="/privacy"
                className="inline-flex h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-semibold"
              >
                {t.trust.ctaPrivacy}
              </Link>
            </div>
          </div>
        </section>

        <section id="contact" className="border-t border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <h2 className="font-display text-4xl font-bold">{t.contact.heading}</h2>
                <p className="mt-3 max-w-xl text-muted-foreground">{t.contact.lead}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="mailto:hello@dishbee.co.uk?subject=dishbee%20demo%20request"
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
                  >
                    <Mail className="h-4 w-4" /> {t.contact.email}
                  </a>
                  <a
                    href="tel:+441727000000"
                    className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-semibold"
                  >
                    <Phone className="h-4 w-4" /> {t.contact.call}
                  </a>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h3 className="font-display text-xl font-bold">{t.contact.cardHeading}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t.contact.cardLead}</p>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {t.contact.cardItems.map((label, i) => {
                    const Ico = contactIcons[i] ?? Receipt;
                    return (
                      <li key={label} className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                          <Ico className="h-4 w-4" strokeWidth={1.9} />
                        </span>
                        {label}
                      </li>
                    );
                  })}
                </ul>
                <a
                  href="https://cafe1stalbans.co.uk"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                >
                  {t.contact.cardLink} <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
  );
}
