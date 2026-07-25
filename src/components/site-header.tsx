import { Link } from "@tanstack/react-router";
import { ShoppingBag, Coffee } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useSession } from "@/hooks/use-auth";

export function SiteHeader() {
  const c = useCart();
  const { user } = useSession();
  const count = c.items.reduce((s, i) => s + i.qty, 0);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
            <Coffee className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Cafe1</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "text-primary" }} className="hover:text-primary">Home</Link>
          <Link to="/menu" activeProps={{ className: "text-primary" }} className="hover:text-primary">Menu</Link>
          <Link to="/about" activeProps={{ className: "text-primary" }} className="hover:text-primary">About</Link>
          <Link to="/contact" activeProps={{ className: "text-primary" }} className="hover:text-primary">Contact</Link>
        </nav>
        <div className="flex items-center gap-2">
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
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
            <Coffee className="h-3.5 w-3.5" />
          </span>
          <span className="font-display font-semibold text-foreground">Cafe1</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex gap-4">
          <Link to="/menu" className="hover:text-primary">Menu</Link>
          <Link to="/contact" className="hover:text-primary">Contact</Link>
          <Link to="/staff" className="hover:text-primary">Staff</Link>
        </div>
      </div>
    </footer>
  );
}