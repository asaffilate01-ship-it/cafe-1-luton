import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import dishbeeLogo from "@/assets/dishbee-logo.png.asset.json";

export const DISHBEE_TAGLINE = "Sell. Serve. Grow.";

export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <div className="dishbee-theme min-h-screen bg-background text-foreground">
      <PlatformHeader />
      {children}
      <PlatformFooter />
    </div>
  );
}

export function PlatformHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/platform" className="flex items-center gap-3">
          <img
            src={dishbeeLogo.url}
            alt="dishbee"
            width={160}
            height={64}
            className="h-9 w-auto"
          />
          <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:inline">
            {DISHBEE_TAGLINE}
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="/platform#services" className="hover:text-foreground">Services</a>
          <a href="/platform#tour" className="hover:text-foreground">Product tour</a>
          <a href="/platform#how" className="hover:text-foreground">How it works</a>
          <a href="/platform#pricing" className="hover:text-foreground">Pricing</a>
          <Link to="/platform/compliance" className="hover:text-foreground">Compliance</Link>
          <a href="/platform#contact" className="hover:text-foreground">Contact</a>
        </nav>
        <a
          href="/platform#contact"
          className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Book a demo
        </a>
      </div>
    </header>
  );
}

export function PlatformFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img src={dishbeeLogo.url} alt="dishbee" width={140} height={56} className="h-7 w-auto" />
          <p>© {new Date().getFullYear()} dishbee — {DISHBEE_TAGLINE}</p>
        </div>
        <div className="flex flex-wrap gap-5">
          <Link to="/platform/compliance" className="hover:text-foreground">Compliance</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/cookies" className="hover:text-foreground">Cookies</Link>
          <Link to="/landlord" className="hover:text-foreground">Operator sign in</Link>
        </div>
      </div>
    </footer>
  );
}
