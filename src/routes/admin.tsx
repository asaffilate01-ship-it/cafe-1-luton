import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminNav } from "@/components/admin-nav";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { updateOrderStatus, markPaidManually, assignDriver, listDrivers } from "@/lib/orders.functions";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Printer, Check } from "lucide-react";
import { useAlertOnIncrease, useNotificationPermission } from "@/hooks/use-order-alerts";
import { Bell, BellOff } from "lucide-react";

type OrderRow = {
  id: string; order_number: number; status: string; payment_status: string;
  type: string; total_cents: number; customer_name: string; customer_phone: string;
  created_at: string; scheduled_for: string | null; schedule_mode: string | null;
  driver_id: string | null;
};
type Driver = { id: string; full_name: string | null; email: string | null };

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
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const update = useServerFn(updateOrderStatus);
  const markPaid = useServerFn(markPaidManually);
  const assign = useServerFn(assignDriver);
  const fetchDrivers = useServerFn(listDrivers);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/admin/login", search: { next: "/admin" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, type, total_cents, customer_name, customer_phone, created_at, scheduled_for, schedule_mode, driver_id")
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

  useEffect(() => {
    if (!user || (!has("admin") && !has("staff"))) return;
    fetchDrivers().then((d) => setDrivers(d as Driver[])).catch(() => {});
  }, [user, has, fetchDrivers]);

  async function setStatus(o: OrderRow, next: string, label?: string) {
    try {
      await update({ data: { order_id: o.id, status: next as "preparing" } });
      toast.success(label ?? `Marked ${next.replace(/_/g, " ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function doAssign(orderId: string, driverId: string) {
    if (!driverId) return;
    try {
      await assign({ data: { order_id: orderId, driver_id: driverId } });
      toast.success("Driver assigned · out for delivery");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const incoming = orders.filter((o) => o.status === "paid");
  useAlertOnIncrease(incoming.length, "New order · Cafe1", `${incoming.length} order${incoming.length === 1 ? "" : "s"} awaiting acceptance`);
  const { perm, request } = useNotificationPermission();

  if (!rolesLoading && user && !has("admin") && !has("staff")) {
    return <div className="p-10 text-center text-muted-foreground">Not authorised. Ask an admin to grant you a role.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold">Orders</h1>
          <div className="flex gap-2 text-sm">
            <button
              onClick={request}
              className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 font-semibold hover:border-primary"
              title={perm === "granted" ? "Alerts on" : "Enable alerts"}
            >
              {perm === "granted" ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
              <span className="hidden sm:inline">{perm === "granted" ? "Alerts on" : perm === "unsupported" ? "No alerts" : "Enable alerts"}</span>
            </button>
            <Link to="/kds" className="rounded-full border border-border bg-card px-4 py-2 font-semibold hover:border-primary">KDS</Link>
            <Link to="/driver" className="rounded-full border border-border bg-card px-4 py-2 font-semibold hover:border-primary">Driver</Link>
            <Link to="/admin/menu" className="rounded-full border border-border bg-card px-4 py-2 font-semibold hover:border-primary">Menu</Link>
          </div>
        </div>

        {incoming.length > 0 && (
          <section className="mt-6 rounded-2xl border-2 border-primary bg-primary-soft/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-primary">🔔 New orders awaiting acceptance ({incoming.length})</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {incoming.map((o) => (
                <div key={o.id} className="flex flex-col rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-xl font-bold">#{o.order_number}</p>
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      {o.type === "collection" ? "Pickup" : o.type.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{o.customer_name} · {money(o.total_cents)}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.schedule_mode === "scheduled" && o.scheduled_for
                      ? `For ${new Date(o.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "ASAP"}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setStatus(o, "preparing", "Accepted · sent to kitchen")} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
                      <Check className="h-4 w-4" /> Accept
                    </button>
                    <a href={`/print/${o.id}`} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:border-primary hover:text-primary" aria-label="Print"><Printer className="h-4 w-4" /></a>
                    <button onClick={() => setStatus(o, "cancelled", "Cancelled")} className="rounded-full border border-border px-3 text-xs font-semibold hover:border-primary hover:text-primary">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
                  <td className="p-3 capitalize">
                    {o.type === "collection" ? "Pickup" : o.type.replace("_", " ")}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {o.schedule_mode === "scheduled" && o.scheduled_for
                        ? new Date(o.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "ASAP"}
                    </span>
                  </td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${o.payment_status === "paid" ? "bg-primary-soft text-primary" : "bg-secondary text-muted-foreground"}`}>{o.payment_status}</span></td>
                  <td className="p-3 capitalize">{o.status.replace(/_/g, " ")}</td>
                  <td className="p-3 font-semibold">{money(o.total_cents)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {o.payment_status !== "paid" && o.payment_status !== "on_account" && (
                        <button onClick={() => markPaid({ data: { order_id: o.id } }).then(() => toast.success("Marked paid")).catch(() => toast.error("Failed"))} className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold hover:bg-primary-soft">Mark paid</button>
                      )}
                      {o.status === "paid" && (
                        <button onClick={() => setStatus(o, "preparing", "Accepted")} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">Accept</button>
                      )}
                      {o.status === "preparing" && (
                        <button onClick={() => setStatus(o, "ready")} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">→ ready</button>
                      )}
                      {o.status === "ready" && o.type === "delivery" && (
                        <select
                          defaultValue=""
                          onChange={(e) => doAssign(o.id, e.target.value)}
                          className="rounded-full border border-border bg-card px-2 py-1 text-xs font-semibold hover:border-primary"
                        >
                          <option value="" disabled>Assign driver…</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>{d.full_name || d.email || d.id.slice(0, 6)}</option>
                          ))}
                          {!drivers.length && <option disabled>No drivers</option>}
                        </select>
                      )}
                      {o.status === "ready" && (o.type === "collection" || o.type === "dine_in") && (
                        <button onClick={() => setStatus(o, "completed", o.type === "dine_in" ? "Served" : "Collected")} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">
                          {o.type === "dine_in" ? "Served" : "Collected"}
                        </button>
                      )}
                      {o.status === "out_for_delivery" && (
                        <span className="text-xs text-muted-foreground">Driver en route</span>
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