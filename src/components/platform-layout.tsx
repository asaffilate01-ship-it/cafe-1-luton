import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Home, LayoutGrid, ShieldCheck, Mail } from "lucide-react";
import dishbeeLogo from "@/assets/dishbee-logo.png.asset.json";

export const DISHBEE_TAGLINE = "Sell. Serve. Grow.";

export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <div className="dishbee-theme min-h-screen bg-background text-foreground">
      <PlatformHeader />
      <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
      <PlatformFooter />
      <PlatformTabBar />
    </div>
  );
}

export function PlatformHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5 md:flex md:justify-between md:py-3">
        <Link to="/platform" className="flex min-w-0 items-center gap-3">
          <img
            src={dishbeeLogo.url}
            alt="dishbee"
            width={240}
            height={96}
            className="h-12 w-auto shrink-0 sm:h-14 md:h-16"
          />
          <span className="hidden truncate text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:inline">
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
          className="inline-flex h-10 shrink-0 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground sm:px-5"
        >
          Book a demo
        </a>
      </div>
    </header>
  );
}

function PlatformTabBar() {
  const tabs = [
    { href: "/platform", label: "Home", Icon: Home },
    { href: "/platform#services", label: "Services", Icon: LayoutGrid },
    { href: "/platform/compliance", label: "Trust", Icon: ShieldCheck },
    { href: "/platform#contact", label: "Contact", Icon: Mail },
  ];
  return (
    <nav
      aria-label="Platform"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {tabs.map(({ href, label, Icon }) => (
          <li key={label} className="flex-1">
            <a
              href={href}
              className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground transition active:text-primary"
            >
              <Icon className="h-[22px] w-[22px]" />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
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
