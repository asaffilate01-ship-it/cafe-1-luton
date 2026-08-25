import { Link, useRouterState } from "@tanstack/react-router";
import { Home, UtensilsCrossed, ShoppingBag, User } from "lucide-react";
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
                  <Icon className={`h-[22px] w-[22px] ${active ? "scale-110" : ""} transition-transform`} />
                  {badge > 0 && (
                    <span className="absolute -right-2.5 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                {label}
                {active && (
                  <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
