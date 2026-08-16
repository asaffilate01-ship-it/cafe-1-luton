import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";

export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
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
        <Link to="/platform" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-4 w-4" />
          </span>
          Cafe 1 Platform
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="/platform#services" className="hover:text-foreground">Services</a>
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
        <p>© {new Date().getFullYear()} Cafe 1 Platform. All rights reserved.</p>
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
