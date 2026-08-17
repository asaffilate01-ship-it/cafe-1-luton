import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, ShieldCheck, Mail, Languages } from "lucide-react";
import dishbeeLogo from "@/assets/dishbee-logo.png.asset.json";
import { PlatformI18nProvider, usePlatformI18n } from "@/components/platform-i18n-provider";


export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <PlatformI18nProvider>
      <div className="dishbee-theme min-h-screen bg-background text-foreground">
        <PlatformHeader />
        <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
        <PlatformFooter />
        <PlatformTabBar />
      </div>
    </PlatformI18nProvider>
  );
}

function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = usePlatformI18n();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "de" ? "en" : "de")}
      aria-label={`${t.langLabel}: ${t.langSwitchTo}`}
      title={t.langSwitchTo}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:border-primary/40 hover:text-primary ${className}`}
    >
      <Languages className="h-4 w-4" />
      {locale === "de" ? "DE" : "EN"}
    </button>
  );
}

export function PlatformHeader() {
  const { t } = usePlatformI18n();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 md:flex md:justify-between md:py-3">
        <Link to="/platform" className="flex min-w-0 items-center gap-3">
          <img
            src={dishbeeLogo.url}
            alt="dishbee — Sell. Serve. Grow."
            width={240}
            height={100}
            className="h-12 w-auto shrink-0 sm:h-14 md:h-16"
          />
          <span className="hidden truncate text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:inline">
            {t.hero.badge}
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="/platform#services" className="hover:text-foreground">{t.nav.services}</a>
          <a href="/platform#tour" className="hover:text-foreground">{t.nav.tour}</a>
          <a href="/platform#how" className="hover:text-foreground">{t.nav.how}</a>
          <a href="/platform#pricing" className="hover:text-foreground">{t.nav.pricing}</a>
          <Link to="/platform/compliance" className="hover:text-foreground">{t.nav.compliance}</Link>
          <a href="/platform#contact" className="hover:text-foreground">{t.nav.contact}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <a
            href="/platform#contact"
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground sm:px-5"
          >
            {t.nav.bookDemo}
          </a>
        </div>
      </div>
    </header>
  );
}

function PlatformTabBar() {
  const { t } = usePlatformI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash ?? "" });
  const tabs = [
    { href: "/platform", label: t.nav.home, Icon: Home, exact: true },
    { href: "/platform#services", label: t.nav.services, Icon: LayoutGrid },
    { href: "/platform/compliance", label: t.nav.trust, Icon: ShieldCheck },
    { href: "/platform#contact", label: t.nav.contact, Icon: Mail },
  ];
  return (
    <nav
      aria-label="Platform"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {tabs.map(({ href, label, Icon, exact }) => {
          const isHash = href.includes("#");
          const basePath = isHash ? href.split("#")[0] : href;
          const active = exact
            ? path === basePath && (!isHash || hash === href.split("#")[1])
            : path === basePath || path.startsWith(`${basePath}/`);
          return (
            <li key={label} className="flex-1">
              <a
                href={href}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icon className={`h-[22px] w-[22px] transition-transform ${active ? "scale-110" : ""}`} />
                {label}
                {active && (
                  <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" />
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PlatformFooter() {
  const { t } = usePlatformI18n();
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img
            src={dishbeeLogo.url}
            alt="dishbee — Sell. Serve. Grow."
            width={140}
            height={58}
            className="h-8 w-auto"
          />
          <p>© {new Date().getFullYear()} dishbee — {t.hero.badge}</p>
        </div>
        <div className="flex flex-wrap gap-5">
          <Link to="/platform/compliance" className="hover:text-foreground">{t.nav.compliance}</Link>
          <Link to="/privacy" className="hover:text-foreground">{t.nav.privacy}</Link>
          <Link to="/terms" className="hover:text-foreground">{t.nav.terms}</Link>
          <Link to="/cookies" className="hover:text-foreground">{t.nav.cookies}</Link>
          <Link to="/landlord" className="hover:text-foreground">{t.nav.operatorSignIn}</Link>
        </div>
      </div>
    </footer>
  );
}
