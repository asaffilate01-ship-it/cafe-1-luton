import { Link } from "@tanstack/react-router";
import { ShoppingBag, ReceiptText, MapPin, Facebook, Instagram, Youtube, Music2 } from "lucide-react";
import { openCookieSettings } from "@/lib/cookie-consent";
import logo from "@/assets/cafe1-logo.png.asset.json";
import { useCart } from "@/lib/cart";
import { useSession } from "@/hooks/use-auth";
import { useTab } from "@/lib/tab";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.67-.06-1.32-.17-1.95H12v3.7h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.99-4.32 2.99-7.27z"/>
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.23-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A9.99 9.99 0 0 0 12 22z"/>
      <path fill="#FBBC05" d="M6.41 13.89A6.02 6.02 0 0 1 6.09 12c0-.66.11-1.3.32-1.89V7.52H3.07A9.99 9.99 0 0 0 2 12c0 1.61.39 3.14 1.07 4.48l3.34-2.59z"/>
      <path fill="#EA4335" d="M12 5.98c1.47 0 2.78.5 3.82 1.5l2.86-2.86C16.95 2.99 14.7 2 12 2A9.99 9.99 0 0 0 3.07 7.52l3.34 2.59C7.2 7.74 9.4 5.98 12 5.98z"/>
    </svg>
  );
}

export function SiteHeader() {
  const c = useCart();
  const { user } = useSession();
  const tabSession = useTab();
  const count = c.items.reduce((s, i) => s + i.qty, 0);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo.url} alt="Café 1 logo" className="h-10 w-auto" width={40} height={40} />
          <span className="sr-only">Café 1</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "text-primary" }} className="hover:text-primary">Home</Link>
          <Link to="/menu" activeProps={{ className: "text-primary" }} className="hover:text-primary">Menu</Link>
          <Link to="/about" activeProps={{ className: "text-primary" }} className="hover:text-primary">About</Link>
          <Link to="/contact" activeProps={{ className: "text-primary" }} className="hover:text-primary">Contact</Link>
        </nav>
        <div className="flex items-center gap-2">
          {tabSession && (
            <Link to="/tab" className="hidden items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary sm:inline-flex" title={`Tab: ${tabSession.name}`}>
              <ReceiptText className="h-3.5 w-3.5" />
              <span className="max-w-[8rem] truncate">{tabSession.name}</span>
            </Link>
          )}
          <Link to="/cart" className="relative inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:border-primary hover:text-primary">
            <ShoppingBag className="h-4 w-4" />
            Cart
            {count > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{count}</span>
            )}
          </Link>
          {user ? (
            <Link to="/account" className="hidden text-sm font-medium hover:text-primary sm:inline">Account</Link>
          ) : (
            <Link to="/auth" className="hidden text-sm font-medium hover:text-primary sm:inline">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-secondary/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <img src={logo.url} alt="Café 1 logo" className="h-7 w-auto" width={28} height={28} loading="lazy" />
            <span>© {new Date().getFullYear()}</span>
          </div>
          <address className="flex items-center gap-1.5 not-italic">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Cafe 1, St Albans Crown Court, AL1 3JW
          </address>
          <div className="mt-3 flex items-center gap-2">
            {[
              {
                href: "https://www.google.com/search?q=Cafe+1+St+Albans+Crown+Court+AL1+3JW",
                label: "Café 1 on Google",
                Icon: GoogleIcon,
              },
              { href: "https://facebook.com", label: "Café 1 on Facebook", Icon: Facebook },
              { href: "https://instagram.com", label: "Café 1 on Instagram", Icon: Instagram },
              { href: "https://tiktok.com", label: "Café 1 on TikTok", Icon: Music2 },
              { href: "https://youtube.com", label: "Café 1 on YouTube", Icon: Youtube },
            ].map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={label}
                title={label}
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-2">
          <Link to="/menu" className="hover:text-primary">Menu</Link>
          <Link to="/contact" className="hover:text-primary">Contact</Link>
          <Link to="/privacy" className="hover:text-primary">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-primary">Terms &amp; Conditions</Link>
          <Link to="/cookies" className="hover:text-primary">Cookie Policy</Link>
          <Link to="/gdpr" className="hover:text-primary">GDPR</Link>
          <Link to="/complaints" className="hover:text-primary">Complaints</Link>
          <button onClick={openCookieSettings} className="text-left hover:text-primary">Cookie settings</button>
          <Link to="/staff" className="hover:text-primary">Staff</Link>
        </nav>
      </div>
    </footer>
  );
}