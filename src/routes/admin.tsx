import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { updateOrderStatus, markPaidManually } from "@/lib/orders.functions";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Printer } from "lucide-react";

type OrderRow = {
  id: string; order_number: number; status: string; payment_status: string;
  type: string; total_cents: number; customer_name: string; customer_phone: string;
  created_at: string;
};

const NEXT: Record<string, string> = {
  paid: "preparing",
  preparing: "ready",
  ready: "out_for_delivery",
  out_for_delivery: "delivered",
};

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Cafe1" },
      { name: "description", content: "Cafe1 admin dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { user, loading } = useSession();
  const { has, loading: rolesLoading } = useRoles(user);
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const update = useServerFn(updateOrderStatus);
  const markPaid = useServerFn(markPaidManually);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/admin/login", search: { next: "/admin" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, type, total_cents, customer_name, customer_phone, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setOrders((data ?? []) as OrderRow[]);
    }
    load();
    const ch = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (!rolesLoading && user && !has("admin") && !has("staff")) {
    return <div className="p-10 text-center text-muted-foreground">Not authorised. Ask an admin to grant you a role.</div>;
  }

  async function advance(o: OrderRow) {
    const next = NEXT[o.status];
    if (!next) return;
    try {
      await update({ data: { order_id: o.id, status: next as "preparing" } });
      toast.success(`Marked ${next.replace(/_/g, " ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold">Orders</h1>
          <div className="flex gap-2 text-sm">
            <Link to="/kds" className="rounded-full border border-border bg-card px-4 py-2 font-semibold hover:border-primary">KDS</Link>
            <Link to="/driver" className="rounded-full border border-border bg-card px-4 py-2 font-semibold hover:border-primary">Driver</Link>
            <Link to="/admin/menu" className="rounded-full border border-border bg-card px-4 py-2 font-semibold hover:border-primary">Menu</Link>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-primary-soft text-left text-xs uppercase tracking-wider text-primary">
              <tr>
                <th className="p-3">#</th><th className="p-3">Customer</th><th className="p-3">Type</th>
                <th className="p-3">Payment</th><th className="p-3">Status</th><th className="p-3">Total</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="p-3 font-semibold">#{o.order_number}</td>
                  <td className="p-3">{o.customer_name}<br /><span className="text-xs text-muted-foreground">{o.customer_phone}</span></td>
                  <td className="p-3 capitalize">{o.type.replace("_", " ")}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${o.payment_status === "paid" ? "bg-primary-soft text-primary" : "bg-secondary text-muted-foreground"}`}>{o.payment_status}</span></td>
                  <td className="p-3 capitalize">{o.status.replace(/_/g, " ")}</td>
                  <td className="p-3 font-semibold">{money(o.total_cents)}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      {o.payment_status !== "paid" && (
                        <button onClick={() => markPaid({ data: { order_id: o.id } }).then(() => toast.success("Marked paid")).catch(() => toast.error("Failed"))} className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold hover:bg-primary-soft">Mark paid</button>
                      )}
                      {NEXT[o.status] && (
                        <button onClick={() => advance(o)} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">→ {NEXT[o.status].replace(/_/g, " ")}</button>
                      )}
                      <a href={`/print/${o.id}`} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-full border border-border hover:border-primary hover:text-primary" aria-label="Print">
                        <Printer className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}