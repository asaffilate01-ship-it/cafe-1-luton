import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { money } from "@/lib/format";
import { useEffect } from "react";

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

  const { data: orders } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total_cents, status, created_at, type")
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-4xl font-bold">Your account</h1>
        {user && <p className="mt-1 text-muted-foreground">{user.email}</p>}
        <div className="mt-3">
          <button onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" }))} className="text-sm text-primary hover:underline">Sign out</button>
        </div>

        <h2 className="mt-10 font-display text-2xl font-bold">Recent orders</h2>
        <ul className="mt-4 space-y-3">
          {(orders ?? []).map((o) => (
            <li key={o.id}>
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
            </li>
          ))}
          {orders && orders.length === 0 && <p className="text-muted-foreground">No orders yet.</p>}
        </ul>
      </div>
    </div>
  );
}