import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession, useRoles } from "@/hooks/use-auth";
import { LayoutDashboard, MonitorPlay, Bike, BookOpen, Megaphone, ReceiptText, UserCog } from "lucide-react";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff — Cafe1" },
      { name: "description", content: "Cafe1 staff hub." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StaffHub,
});

function StaffHub() {
  const { user, loading } = useSession();
  const { roles, has } = useRoles(user);
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/admin/login", search: { next: "/staff" } });
  }, [loading, user, navigate]);

  const cards = [
    { to: "/admin" as const, icon: LayoutDashboard, title: "Admin dashboard", desc: "Orders, menu, drivers.", show: has("admin") || has("staff") },
    { to: "/admin/menu" as const, icon: BookOpen, title: "Menu manager", desc: "Categories, items, modifiers, images.", show: has("admin") || has("staff") },
    { to: "/admin/broadcasts" as const, icon: Megaphone, title: "Broadcasts", desc: "Publish offers and announcements.", show: has("admin") || has("staff") },
    { to: "/admin/accounts" as const, icon: ReceiptText, title: "Tab accounts", desc: "Business tabs, access codes and bills.", show: has("admin") || has("staff") },
    { to: "/admin/users" as const, icon: UserCog, title: "Users & roles", desc: "Grant staff, driver or admin access.", show: has("admin") },
    { to: "/kds" as const, icon: MonitorPlay, title: "Kitchen display", desc: "Live tickets for the kitchen.", show: has("admin") || has("staff") },
    { to: "/driver" as const, icon: Bike, title: "Driver app", desc: "Pick up and deliver orders.", show: has("admin") || has("driver") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-4xl font-bold">Staff tools</h1>
        <p className="mt-1 text-muted-foreground">Signed in as {user?.email} · roles: {roles.join(", ") || "customer"}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {cards.filter((c) => c.show).map((c) => (
            <Link key={c.to} to={c.to} className="rounded-2xl border border-border bg-card p-6 hover:border-primary hover:shadow-brand">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary"><c.icon className="h-5 w-5" /></span>
              <p className="mt-4 font-semibold">{c.title}</p>
              <p className="text-sm text-muted-foreground">{c.desc}</p>
            </Link>
          ))}
          {!has("admin") && !has("staff") && !has("driver") && (
            <p className="text-sm text-muted-foreground">You don't have staff access. An admin can grant a role in the user_roles table.</p>
          )}
        </div>
      </div>
    </div>
  );
}