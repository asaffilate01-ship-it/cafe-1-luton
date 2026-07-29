import { Link, useRouterState } from "@tanstack/react-router";
import { useSession, useRoles } from "@/hooks/use-auth";
import { signOutAndRedirect } from "@/lib/sign-out";
import {
  LayoutDashboard,
  BookOpen,
  Megaphone,
  Image as ImageIcon,
  Ticket,
  BadgePercent,
  Settings,
  ReceiptText,
  UserCog,
  MonitorPlay,
  Bike,
  LogOut,
  Home,
  Newspaper,
  BarChart3,
  Calculator,
} from "lucide-react";

type Item = {
  to:
    | "/staff"
    | "/admin"
    | "/admin/menu"
    | "/admin/pos"
    | "/admin/reports"
    | "/admin/blog"
    | "/admin/broadcasts"
    | "/admin/banners"
    | "/admin/promos"
    | "/admin/customer-discounts"
    | "/admin/vouchers"
    | "/admin/settings"
    | "/admin/accounts"
    | "/admin/users"
    | "/kds"
    | "/driver";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  need: "any" | "admin" | "driver";
};

const ITEMS: Item[] = [
  { to: "/staff", label: "Hub", icon: Home, need: "any" },
  { to: "/admin", label: "Orders", icon: LayoutDashboard, need: "any" },
  { to: "/kds", label: "Kitchen", icon: MonitorPlay, need: "any" },
  { to: "/admin/pos", label: "Till", icon: Calculator, need: "any" },
  { to: "/driver", label: "Driver", icon: Bike, need: "driver" },
  { to: "/admin/menu", label: "Menu", icon: BookOpen, need: "any" },
  { to: "/admin/reports", label: "Reports", icon: BarChart3, need: "any" },
  { to: "/admin/blog", label: "Blog", icon: Newspaper, need: "any" },
  { to: "/admin/broadcasts", label: "Broadcasts", icon: Megaphone, need: "any" },
  { to: "/admin/banners", label: "Banners", icon: ImageIcon, need: "any" },
  { to: "/admin/promos", label: "Promos", icon: Ticket, need: "any" },
  { to: "/admin/customer-discounts", label: "Discounts", icon: BadgePercent, need: "any" },
  { to: "/admin/vouchers", label: "Vouchers", icon: Ticket, need: "any" },
  { to: "/admin/accounts", label: "Tabs", icon: ReceiptText, need: "any" },
  { to: "/admin/settings", label: "Settings", icon: Settings, need: "any" },
  { to: "/admin/users", label: "Users", icon: UserCog, need: "admin" },
];

export function AdminNav() {
  const { user } = useSession();
  const { has } = useRoles(user);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!user) return null;
  const isStaff = has("admin") || has("staff");
  const isDriver = has("driver");
  if (!isStaff && !isDriver) return null;

  const items = ITEMS.filter((i) => {
    if (i.need === "admin") return has("admin");
    if (i.need === "driver") return isDriver || has("admin");
    // "any"
    if (i.to === "/driver") return isDriver || has("admin");
    return isStaff;
  });

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          <span className="mr-2 shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
            Café1
          </span>
          {items.map((it) => {
          const active = pathname === it.to || (it.to !== "/staff" && pathname.startsWith(it.to));
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-primary text-primary-foreground shadow-brand"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {it.label}
            </Link>
          );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-2 border-l border-border pl-2">
          <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground lg:inline">
            {user.email}
          </span>
          <button
            onClick={() => void signOutAndRedirect()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-brand transition hover:opacity-90"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}