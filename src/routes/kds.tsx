import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { updateOrderStatus } from "@/lib/orders.functions";
import { toast } from "sonner";
import { useSession, useRoles } from "@/hooks/use-auth";
import { useAlertOnIncrease, useNotificationPermission } from "@/hooks/use-order-alerts";
import { Bell, BellOff } from "lucide-react";

type Item = { id: string; order_id: string; name: string; qty: number; notes: string | null };
type Order = {
  id: string; order_number: number; status: string; type: string; customer_name: string; created_at: string;
  schedule_mode: string | null; scheduled_for: string | null; table_number: string | null;
};
type Ticket = Order & { items: Item[] };

const TYPE_LABEL: Record<string, string> = { dine_in: "DINE IN", collection: "PICKUP", delivery: "DELIVERY" };

function whenLabel(o: { schedule_mode: string | null; scheduled_for: string | null }) {
  if (o.schedule_mode === "scheduled" && o.scheduled_for)
    return new Date(o.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return "ASAP";
}

export const Route = createFileRoute("/kds")({
  head: () => ({
    meta: [
      { title: "Kitchen Display — Cafe1" },
      { name: "description", content: "Live kitchen tickets for Cafe1." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KDS,
});

function KDS() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [kdsPaper, setKdsPaper] = useState<58 | 80>(80);
  const update = useServerFn(updateOrderStatus);
  const { user } = useSession();
  const { has } = useRoles(user);

  useEffect(() => {
    const saved = window.localStorage.getItem("cafe1_kds_paper_mm");
    if (saved === "58") setKdsPaper(58);
  }, []);

  function pickPaper(w: 58 | 80) {
    setKdsPaper(w);
    window.localStorage.setItem("cafe1_kds_paper_mm", String(w));
  }

  useEffect(() => {
    async function load() {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, status, type, customer_name, created_at, schedule_mode, scheduled_for, table_number")
        .in("status", ["preparing", "ready"])
        .order("created_at");
      const ids = (orders ?? []).map((o) => o.id);
      const { data: items } = ids.length
        ? await supabase.from("order_items").select("id, order_id, name, qty, notes").in("order_id", ids)
        : { data: [] as Item[] };
      const grouped: Ticket[] = ((orders ?? []) as Order[]).map((o) => ({
        ...o,
        items: ((items ?? []) as Item[]).filter((i) => i.order_id === o.id),
      }));
      setTickets(grouped);
    }
    load();
    const ch = supabase
      .channel("kds")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (user && !has("admin") && !has("staff"))
    return <div className="p-10 text-center text-muted-foreground">Not authorised.</div>;

  async function set(id: string, status: "preparing" | "ready") {
    try {
      await update({ data: { order_id: id, status } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const preparingCount = tickets.filter((t) => t.status === "preparing").length;
  useAlertOnIncrease(preparingCount, "New ticket · Kitchen", "A new order was accepted — start preparing.");

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="font-display text-2xl font-bold">Kitchen Display · Cafe1</h1>
          <div className="flex items-center gap-3">
            <AlertsToggle />
            <div className="flex items-center gap-1 rounded-full bg-primary-foreground/10 p-1">
              {([58, 80] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => pickPaper(w)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${kdsPaper === w ? "bg-primary-foreground text-primary" : "opacity-80"}`}
                  title="Kitchen printer paper width"
                >
                  {w}mm
                </button>
              ))}
            </div>
            <span className="text-sm opacity-80">{tickets.length} active</span>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tickets.map((t) => {
          const mins = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 60000);
          const hot = mins >= 10;
          return (
            <div key={t.id} className={`flex flex-col rounded-2xl border-2 bg-card p-4 ${hot ? "border-primary shadow-brand" : "border-border"}`}>
              <div className="flex items-center justify-between">
                <p className="font-display text-2xl font-bold">#{t.order_number}</p>
                <span className="text-sm font-bold text-muted-foreground">{mins}m ago</span>
              </div>
              <div className="mt-2 rounded-xl bg-primary px-3 py-2 text-primary-foreground">
                <p className="font-display text-2xl font-black uppercase leading-none tracking-wide">
                  {TYPE_LABEL[t.type] ?? t.type.replace("_", " ").toUpperCase()}
                </p>
                <p className="mt-1 text-xl font-black leading-none">
                  {whenLabel(t) === "ASAP" ? "ASAP" : `FOR ${whenLabel(t)}`}
                </p>
                {t.type === "dine_in" && t.table_number && (
                  <p className="mt-1 text-sm font-bold">TABLE {t.table_number}</p>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.customer_name}</p>
              <ul className="mt-3 flex-1 space-y-1 text-sm">
                {t.items.map((i) => (
                  <li key={i.id}><span className="font-bold text-primary">{i.qty}×</span> {i.name}{i.notes ? <em className="text-muted-foreground"> — {i.notes}</em> : null}</li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                {t.status === "preparing" && <button onClick={() => set(t.id, "ready")} className="h-9 flex-1 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Mark ready</button>}
                {t.status === "ready" && <span className="h-9 flex-1 rounded-full bg-primary-soft text-center text-sm font-semibold leading-9 text-primary">Ready</span>}
                <a href={`/print/${t.id}?paper=${kdsPaper}`} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:border-primary hover:text-primary" aria-label="Print">🖨</a>
              </div>
            </div>
          );
        })}
        {!tickets.length && <div className="col-span-full p-16 text-center text-muted-foreground">No active tickets. Enjoy the quiet ☕</div>}
      </div>
    </div>
  );
}

function AlertsToggle() {
  const { perm, request } = useNotificationPermission();
  return (
    <button
      onClick={request}
      className="flex items-center gap-1 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold hover:bg-primary-foreground/20"
      title={perm === "granted" ? "Alerts on" : "Enable alerts"}
    >
      {perm === "granted" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      <span>{perm === "granted" ? "Alerts on" : perm === "unsupported" ? "No alerts" : "Enable alerts"}</span>
    </button>
  );
}