import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  UtensilsCrossed,
  ShoppingBag,
  User,
  PanelLeftOpen,
  SlidersHorizontal,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useSession } from "@/hooks/use-auth";

/**
 * App-style bottom tab bar for phones (and installed PWA).
 * Hidden on tablets/desktop and on staff surfaces (admin/kds/pos).
 */
export function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const c = useCart();
  const count = c.items.reduce((s, i) => s + i.qty, 0);

  const hidden = /^(\/(admin|kds|pos|till|display|print|pay))/.test(path);
  if (hidden) return null;

  if (path === "/menu") {
    const send = (name: string) => window.dispatchEvent(new Event(name));
    const actions = [
      {
        label: "Categories",
        Icon: PanelLeftOpen,
        onClick: () => send("cafe1:menu-open-categories"),
      },
      {
        label: "Menu",
        Icon: UtensilsCrossed,
        onClick: () => {
          send("cafe1:menu-close-panels");
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
        active: true,
      },
      {
        label: "Details",
        Icon: SlidersHorizontal,
        onClick: () => send("cafe1:menu-open-details"),
      },
    ];
    return (
      <nav
        aria-label="Menu tools"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 shadow-[0_-12px_30px_-24px_rgba(0,0,0,0.55)] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid max-w-md grid-cols-4 px-1">
          {actions.map(({ label, Icon, onClick, active }) => (
            <li key={label}>
              <button
                type="button"
                onClick={onClick}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-95 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-[22px] w-[22px] ${active ? "scale-110" : ""}`} />
                {label}
                {active && (
                  <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            </li>
          ))}
          <li>
            <Link
              to="/cart"
              aria-label="Basket"
              className="relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground transition active:scale-95"
            >
              <span className="relative">
                <ShoppingBag className="h-[22px] w-[22px]" />
                {count > 0 && (
                  <span className="absolute -right-2.5 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
              Basket
            </Link>
          </li>
        </ul>
      </nav>
    );
  }

  const tabs = [
    { to: "/", label: "Home", Icon: Home, exact: true },
    { to: "/menu", label: "Menu", Icon: UtensilsCrossed },
    { to: "/cart", label: "Basket", Icon: ShoppingBag, badge: count },
    { to: user ? "/account" : "/auth", label: user ? "Account" : "Sign in", Icon: User },
  ] as const;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {tabs.map(({ to, label, Icon, ...rest }) => {
          const badge = "badge" in rest ? (rest.badge as number) : 0;
          const exact = "exact" in rest ? rest.exact : false;
          const active = exact ? path === to : path === to || path.startsWith(`${to}/`);
          return (
            <li key={label} className="flex-1">
              <Link
                to={to}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className="relative">
                  <Icon
                    className={`h-[22px] w-[22px] ${active ? "scale-110" : ""} transition-transform`}
                  />
                  {badge > 0 && (
                    <span className="absolute -right-2.5 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                {label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
