import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { money } from "@/lib/format";
import { useEffect } from "react";
import { cart } from "@/lib/cart";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your account — Cafe1" },
      { name: "description", content: "See your recent Cafe1 orders and manage your account." },
      { property: "og:title", content: "Your account — Cafe1" },
      { property: "og:description", content: "See your recent Cafe1 orders and manage your account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Account,
});

function Account() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { next: "/account" } });
  }, [loading, user, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("loyalty_points, lifetime_points, full_name, drink_stamps, free_drinks_available, free_drinks_redeemed")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total_cents, status, created_at, type, points_earned")
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  async function reorder(orderId: string) {
    const { data: lines, error } = await supabase
      .from("order_items")
      .select("menu_item_id, name, qty, unit_price_cents")
      .eq("order_id", orderId);
    if (error || !lines?.length) {
      toast.error("Could not load that order");
      return;
    }
    const ids = lines.map((l) => l.menu_item_id).filter(Boolean) as string[];
    const { data: live } = await supabase
      .from("menu_items")
      .select("id, name, price_cents, active")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const byId = new Map((live ?? []).map((m) => [m.id, m]));

    let added = 0;
    let skipped = 0;
    for (const l of lines) {
      const m = l.menu_item_id ? byId.get(l.menu_item_id) : undefined;
      if (!m || !m.active) { skipped++; continue; }
      cart.add({ menu_item_id: m.id, name: m.name, base_price_cents: m.price_cents }, l.qty);
      added++;
    }
    if (!added) {
      toast.error("None of those items are available right now");
      return;
    }
    toast.success(skipped ? `Added ${added} item(s) — ${skipped} unavailable` : "Added to your basket");
    navigate({ to: "/cart" });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-4xl font-bold">Your account</h1>
        {user && <p className="mt-1 text-muted-foreground">{user.email}</p>}
        <div className="mt-3">
          <button onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" }))} className="text-sm text-primary hover:underline">Sign out</button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
            <p className="text-xs uppercase tracking-wider text-primary/80">Loyalty points</p>
            <p className="mt-1 font-display text-4xl font-bold text-primary">{profile?.loyalty_points ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">Earn 1 point per £1 spent. Coming soon: redeem for free items.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Member perks</p>
            <p className="mt-1 font-display text-2xl font-bold">Exclusive offers</p>
            <p className="mt-1 text-xs text-muted-foreground">Personal discounts are available on request and applied automatically at checkout once approved.</p>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-primary/80">Coffee &amp; tea card</p>
              <p className="text-xs font-semibold text-primary">{profile?.drink_stamps ?? 0}/10</p>
            </div>
            <div className="mt-3 flex gap-1.5">
              {Array.from({ length: 10 }, (_, n) => (
                <span key={n} className={`h-3 flex-1 rounded-full ${n < (profile?.drink_stamps ?? 0) ? "bg-primary" : "bg-primary/20"}`} />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Buy 10 coffees or teas and your 11th is free — applied automatically at checkout.
              {(profile?.free_drinks_available ?? 0) > 0 && ` You have ${profile?.free_drinks_available} free drink${(profile?.free_drinks_available ?? 0) > 1 ? "s" : ""} waiting!`}
            </p>
          </div>
        </div>

        <h2 className="mt-10 font-display text-2xl font-bold">Recent orders</h2>
        <ul className="mt-4 space-y-3">
          {(orders ?? []).map((o) => (
            <li key={o.id} className="relative">
              <Link to="/order/$orderId" params={{ orderId: o.id }} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:border-primary">
                <div>
                  <p className="font-semibold">#{o.order_number} · {o.type}</p>
                  <p className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(o.total_cents)}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{o.status.replace(/_/g, " ")}</p>
                </div>
              </Link>
              <button
                onClick={() => reorder(o.id)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Order this again
              </button>
            </li>
          ))}
          {orders && orders.length === 0 && <p className="text-muted-foreground">No orders yet.</p>}
        </ul>
      </div>
    </div>
  );
}