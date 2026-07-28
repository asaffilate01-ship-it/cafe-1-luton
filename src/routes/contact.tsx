import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Café 1 St Albans — Hours & Address" },
      { name: "description", content: "Café 1 opening hours, address and contact details. St Albans Crown Court, AL1 3JW. Open Monday to Friday, 8am–5pm. Call 01727 400117." },
      { property: "og:title", content: "Contact Café 1 St Albans" },
      { property: "og:description", content: "Opening hours, address and contact details for Café 1, St Albans Crown Court, AL1 3JW." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cafe1stalbans.co.uk/contact" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://cafe1stalbans.co.uk/contact" }],
  }),
  component: Contact,
});

function Contact() {
  const rows = [
    { icon: MapPin, label: "Visit", value: "Cafe 1, St Albans Crown Court, AL1 3JW" },
    { icon: Phone, label: "Call", value: "01727 400117" },
    { icon: Mail, label: "Email", value: "info@cafe1stalbans.co.uk" },
    { icon: Clock, label: "Open", value: "Mon–Fri · 8:00–17:00 (deliveries 8:30–16:30)" },
  ];
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-5xl font-bold">Say hello</h1>
        <p className="mt-3 text-lg text-muted-foreground">Pop in for a coffee, or reach out any time.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="rounded-2xl border border-border bg-card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <r.icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{r.label}</p>
              <p className="mt-1 font-semibold">{r.value}</p>
            </div>
          ))}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}