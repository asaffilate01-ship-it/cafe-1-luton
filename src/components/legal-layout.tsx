import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export function LegalPage({
  title,
  updated = "26 July 2026",
  intro,
  children,
}: {
  title: string;
  updated?: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
        {intro && <p className="mt-4 text-muted-foreground">{intro}</p>}
        <div className="legal-body mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">{children}</div>
        <div className="mt-12 rounded-2xl border border-border bg-secondary/40 p-5 text-sm">
          <p className="font-semibold">Contact us</p>
          <p className="mt-1 text-muted-foreground">
            Cafe 1, St Albans Crown Court, AL1 3JW · <a className="text-primary underline underline-offset-2" href="mailto:hello@cafe1.example">hello@cafe1.example</a>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold text-foreground">{heading}</h2>
      <div className="mt-2 space-y-2 text-muted-foreground">{children}</div>
    </section>
  );
}