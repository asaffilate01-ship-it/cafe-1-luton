import { createFileRoute } from "@tanstack/react-router";
import { AdminNav } from "@/components/admin-nav";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { updateOrderStatus, setOrderFulfilment } from "@/lib/orders.functions";
import { toast } from "sonner";
import { useSession, useRoles } from "@/hooks/use-auth";
import { useAlertOnIncrease, useNotificationPermission, playChime } from "@/hooks/use-order-alerts";
import { Bell, BellOff, RefreshCw } from "lucide-react";
import { syncSumupPos } from "@/lib/sumup-pos.functions";
import { orderCode } from "@/lib/order-code";

type Item = { id: string; order_id: string; menu_item_id: string | null; name: string; qty: number; notes: string | null; cook?: boolean };
type Order = {
  id: string; order_number: number; status: string; type: string; customer_name: string; created_at: string;
  schedule_mode: string | null; scheduled_for: string | null; table_number: string | null;
  source: string | null;
  payment_method: string | null;
  payment_status: string | null;
  customer_phone: string | null;
  company_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  delivery_notes: string | null;
  pos_terminal: string | null;
};
type Ticket = Order & { items: Item[]; needsCooking: boolean };

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
  const setFulfil = useServerFn(setOrderFulfilment);
  const sync = useServerFn(syncSumupPos);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { user } = useSession();
  const { has } = useRoles(user);

  // Live kitchen timer — ticks every second
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, []);

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
        .select("id, order_number, status, type, customer_name, created_at, schedule_mode, scheduled_for, table_number, source, payment_method, payment_status, customer_phone, company_name, address_line1, address_line2, city, postcode, delivery_notes, pos_terminal")
        .in("status", ["preparing", "ready"])
        .order("created_at");
      const ids = (orders ?? []).map((o) => o.id);
      const { data: items } = ids.length
        ? await supabase.from("order_items").select("id, order_id, menu_item_id, name, qty, notes").in("order_id", ids)
        : { data: [] as Item[] };
      const { data: menu } = await supabase.from("menu_items").select("id, name, needs_cooking");
      const byId = new Map<string, boolean>();
      const byName = new Map<string, boolean>();
      for (const m of (menu ?? []) as { id: string; name: string; needs_cooking: boolean }[]) {
        byId.set(m.id, !!m.needs_cooking);
        byName.set(m.name.trim().toLowerCase(), !!m.needs_cooking);
      }
      const cooks = (i: Item) =>
        (i.menu_item_id ? byId.get(i.menu_item_id) : undefined) ??
        byName.get(i.name.trim().toLowerCase()) ??
        false;
      const grouped: Ticket[] = ((orders ?? []) as Order[]).map((o) => {
        const its = ((items ?? []) as Item[])
          .filter((i) => i.order_id === o.id)
          .map((i) => ({ ...i, cook: cooks(i) }));
        return { ...o, items: its, needsCooking: its.some((i) => i.cook) };
      });
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

  // Auto-poll SumUp POS every 30s while KDS is open (staff/admin only)
  useEffect(() => {
    if (!user || (!has("admin") && !has("staff"))) return;
    let cancelled = false;
    async function tick() {
      try {
        const r = await sync({ data: undefined as never });
        if (!cancelled && r?.imported && r.imported > 0) {
          toast.success(`${r.imported} SumUp POS ${r.imported === 1 ? "order" : "orders"} imported`);
        }
      } catch { /* silent */ }
    }
    tick();
    const iv = window.setInterval(tick, 30000);
    return () => { cancelled = true; window.clearInterval(iv); };
  }, [user, has, sync]);

  async function manualSync() {
    setSyncing(true);
    try {
      const r = await sync({ data: undefined as never });
      if (r?.error) toast.error(`SumUp: ${r.error}`);
      else toast.success(`SumUp sync: ${r?.imported ?? 0} imported, ${r?.skipped ?? 0} skipped`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function set(id: string, status: "preparing" | "ready" | "completed") {
    try {
      await update({ data: { order_id: id, status } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function markDineIn(id: string, current: string) {
    try {
      if (current === "dine_in") {
        await setFulfil({ data: { order_id: id, type: "collection", table_number: null } });
        toast.success("Marked as pickup");
      } else {
        const table = window.prompt("Table number (optional)") ?? "";
        await setFulfil({
          data: { order_id: id, type: "dine_in", table_number: table.trim() || null },
        });
        toast.success("Marked as dine in");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const preparingCount = tickets.filter((t) => t.status === "preparing").length;
  useAlertOnIncrease(preparingCount, "New ticket · Kitchen", "A new order was accepted — start preparing.");

  if (user && !has("admin") && !has("staff"))
    return <div className="p-10 text-center text-muted-foreground">Not authorised.</div>;

  return (
    <div className="min-h-screen bg-secondary">
      <AdminNav />
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="font-display text-2xl font-bold">Kitchen Display · Cafe1</h1>
          <div className="flex items-center gap-3">
            <AlertsToggle />
            <button
              onClick={manualSync}
              disabled={syncing}
              className="flex items-center gap-1 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold hover:bg-primary-foreground/20 disabled:opacity-50"
              title="Pull latest transactions from your SumUp terminal"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Syncing…" : "Sync SumUp POS"}</span>
            </button>
            <a
              href={`/print/test?paper=${kdsPaper}&preview=1`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold hover:bg-primary-foreground/20"
              title="Print a sample ticket on this device — no order is created"
            >
              Test print
            </a>
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
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 pb-3 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-600 ring-2 ring-white/60" /> Cooked / hot food</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white/60" /> No cooking (drinks &amp; cold)</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white/60" /> Ready → complete</span>
          </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tickets.map((t) => {
          const elapsedSec = Math.max(0, Math.floor((now - new Date(t.created_at).getTime()) / 1000));
          const mins = Math.floor(elapsedSec / 60);
          const clock = `${mins}:${String(elapsedSec % 60).padStart(2, "0")}`;
          const hot = mins >= 10;
          const timerTone =
            mins >= 20 ? "bg-red-600 text-white animate-pulse"
            : mins >= 10 ? "bg-amber-500 text-white"
            : "bg-slate-800 text-white";
          const cook = t.needsCooking;
          return (
            <div
              key={t.id}
              className={`flex flex-col rounded-2xl border-4 p-4 ${
                cook ? "border-blue-600 bg-blue-50" : "border-amber-400 bg-amber-50"
              } ${hot ? "shadow-brand" : ""}`}
            >
              <div className={`-mx-4 -mt-4 mb-3 rounded-t-xl px-4 py-1.5 text-center text-xs font-black uppercase tracking-widest text-white ${cook ? "bg-blue-600" : "bg-amber-500"}`}>
                {cook ? "Cook / hot food" : "No cooking needed"}
              </div>
              <div className="flex items-center justify-between">
                <p className="font-display text-2xl font-bold">#{t.order_number}</p>
                <div className="flex items-center gap-2">
                  {t.source === "sumup_pos" && (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">SumUp POS</span>
                  )}
                  {t.source === "deliveroo" && (
                    <span className="rounded-full bg-[#00CCBC] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Deliveroo</span>
                  )}
                  {t.source === "counter" && (
                    <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Counter</span>
                  )}
                  {t.source !== "sumup_pos" && t.source !== "deliveroo" && t.source !== "counter" && (
                    <span className="rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Website</span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${t.payment_method === "cash" ? "bg-emerald-600 text-white" : "bg-slate-800 text-white"}`}>
                    {t.payment_method === "cash" ? "Cash" : "Card"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-base font-black tabular-nums ${timerTone}`}
                    title="Time in kitchen since the order was accepted"
                  >
                    {clock}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                {new Date(t.created_at).toLocaleString([], { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
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
                <button
                  onClick={() => markDineIn(t.id, t.type)}
                  className="mt-2 rounded-full bg-primary-foreground/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide hover:bg-primary-foreground/30"
                  title="Switch this ticket between dine in and pickup"
                >
                  {t.type === "dine_in" ? "Change to pickup" : "Mark as dine in"}
                </button>
              </div>
              <p className="mt-2 text-base font-black uppercase tracking-wide text-foreground">{t.customer_name}</p>
              {t.source === "deliveroo" && (
                <p className="mt-2 rounded-xl border-2 border-[#00CCBC] bg-[#00CCBC]/10 px-3 py-2 text-xs font-black uppercase tracking-wide text-[#007e75]">
                  Attach the Deliveroo receipt printed on the tablet to this order
                </p>
              )}
              <p className="mt-1 inline-block rounded-md bg-slate-900 px-2 py-0.5 font-mono text-sm font-black tracking-widest text-white">
                {orderCode(t)}
              </p>
              {t.type === "delivery" && (
                <div className="mt-2 rounded-xl border-2 border-slate-900 bg-white p-2 text-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deliver to</p>
                  {t.postcode && (
                    <p className="font-display text-xl font-black uppercase leading-none">{t.postcode}</p>
                  )}
                  {t.company_name && <p className="mt-1 font-bold">{t.company_name}</p>}
                  {t.address_line1 && <p className="font-semibold">{t.address_line1}</p>}
                  {t.address_line2 && <p className="font-semibold">{t.address_line2}</p>}
                  {t.city && <p className="text-muted-foreground">{t.city}</p>}
                  {t.customer_phone && <p className="mt-1 font-bold">☎ {t.customer_phone}</p>}
                  {t.delivery_notes && (
                    <p className="mt-1 rounded bg-amber-100 px-1.5 py-1 text-xs font-semibold text-amber-900">
                      NOTE: {t.delivery_notes}
                    </p>
                  )}
                </div>
              )}
              <ul className="mt-3 flex-1 space-y-1 text-sm">
                {t.items.map((i) => (
                  <li key={i.id} className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${i.cook ? "bg-blue-600" : "bg-amber-400"}`} />
                    <span><span className="font-bold text-primary">{i.qty}×</span> {i.name}{i.notes ? <em className="text-muted-foreground"> — {i.notes}</em> : null}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                {t.status === "preparing" && (
                  <button
                    onClick={() => set(t.id, "ready")}
                    className={`h-9 flex-1 rounded-full text-sm font-bold ${cook ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-amber-400 text-amber-950 hover:bg-amber-500"}`}
                  >
                    Mark ready
                  </button>
                )}
                {t.status === "ready" && (
                  <button onClick={() => set(t.id, "completed")} className="h-9 flex-1 rounded-full bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700">
                    Mark complete
                  </button>
                )}
                <a href={`/print/${t.id}?paper=${kdsPaper}&preview=1`} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:border-primary hover:text-primary" aria-label="Print preview" title="Preview then print">👁</a>
                <a href={`/print/${t.id}?paper=${kdsPaper}`} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:border-primary hover:text-primary" aria-label="Print" title="Print now">🖨</a>
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
    <div className="flex items-center gap-1">
      <button
        onClick={request}
        className="flex items-center gap-1 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold hover:bg-primary-foreground/20"
        title={perm === "granted" ? "Alerts on" : "Enable alerts"}
      >
        {perm === "granted" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        <span>{perm === "granted" ? "Alerts on" : perm === "unsupported" ? "No alerts" : "Enable alerts"}</span>
      </button>
      <button
        onClick={() => playChime()}
        className="rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold hover:bg-primary-foreground/20"
        title="Play the new-order chime"
      >
        Test sound
      </button>
    </div>
  );
}