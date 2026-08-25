import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { LiveMap } from "@/components/live-map";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { LOCATIONS, SITE_URL, localBusinessJsonLd } from "@/lib/nap";
import { breadcrumbJsonLd, canonicalLink, jsonLdScript, seoMeta, webPageJsonLd } from "@/lib/seo";

const title = "Contact Café 1 Luton | Crown Court & Futures House";
const description =
  "Contact or visit Café 1 at Luton Crown Court, LU1 2AA, or Futures House in Marsh Farm, LU3 3QB. Call 01582 484802.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: seoMeta({ title, description, path: "/contact" }),
    links: [canonicalLink("/contact")],
    scripts: [
      jsonLdScript(localBusinessJsonLd(`${SITE_URL}/icon-512.png`)),
      jsonLdScript(webPageJsonLd({ name: title, description, path: "/contact" })),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Contact Café 1", path: "/contact" },
        ]),
      ),
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Two Luton locations
          </p>
          <h1 className="mt-2 font-display text-5xl font-bold">Come and say hello</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Choose the Café 1 location that suits you. Both branches welcome the public for dine-in
            and takeaway.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {LOCATIONS.map((location) => {
            const directionsUrl =
              "https://www.google.com/maps/dir/?api=1&destination=" +
              encodeURIComponent(
                `${location.name}, ${location.streetAddress}, ${location.addressLocality} ${location.postalCode}`,
              );
            const point = {
              lat: location.latitude,
              lng: location.longitude,
              label: location.name,
              kind: "store" as const,
            };

            return (
              <article
                key={location.id}
                className="card-3d card-3d-hover overflow-hidden rounded-[1.75rem] border border-border bg-card"
              >
                <div className="p-6 sm:p-7">
                  <div className="flex items-start gap-4">
                    <span className="icon-3d h-12 w-12 shrink-0">
                      <MapPin className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                        {location.shortName}
                      </p>
                      <h2 className="mt-1 font-display text-2xl font-bold">{location.name}</h2>
                      <p className="mt-2 leading-relaxed text-muted-foreground">
                        {location.streetAddress}
                        <br />
                        {location.addressLocality}, {location.addressRegion} {location.postalCode}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-6 grid gap-3 text-sm">
                    <ContactRow Icon={Phone} label="Call">
                      <a
                        href={`tel:${location.telephone.replace(/\s/g, "")}`}
                        className="font-semibold hover:text-primary"
                      >
                        01582 484802
                      </a>
                    </ContactRow>
                    <ContactRow Icon={Mail} label="Email">
                      <a
                        href={`mailto:${location.email}`}
                        className="font-semibold hover:text-primary"
                      >
                        {location.email}
                      </a>
                    </ContactRow>
                    <ContactRow Icon={Clock} label="Opening times">
                      <span className="font-semibold">{location.hoursLabel}</span>
                    </ContactRow>
                  </dl>

                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover"
                  >
                    Get directions <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
                <div className="border-t border-border p-3">
                  <LiveMap
                    points={[point]}
                    fallbackHref={directionsUrl}
                    className="h-60 w-full rounded-2xl"
                  />
                </div>
              </article>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ContactRow({
  Icon,
  label,
  children,
}: {
  Icon: typeof Phone;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1.5rem_6.5rem_1fr] items-start gap-2 rounded-xl bg-soft px-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 text-primary" />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
