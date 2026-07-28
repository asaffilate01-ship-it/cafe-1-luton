import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Cafe1 — Visit or get in touch" },
      { name: "description", content: "Cafe1 opening hours, address and contact details." },
      { property: "og:title", content: "Contact Cafe1" },
      { property: "og:description", content: "Cafe1 opening hours, address and contact details." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const rows = [
    { icon: MapPin, label: "Visit", value: "Cafe 1, St Albans Crown Court, AL1 3JW" },
    { icon: Phone, label: "Call", value: "020 7000 0000" },
    { icon: Mail, label: "Email", value: "info@cafe1stalbans.co.uk" },
    { icon: Clock, label: "Open", value: "Mon–Sun · 8:30–17:00 (delivery until 16:30)" },
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