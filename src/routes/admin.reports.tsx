import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminNav } from "@/components/admin-nav";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-auth";
import { money } from "@/lib/format";
import { Download, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Sales reports — Cafe1" },
      { name: "description", content: "Daily and weekly sales, top items and order mix for Cafe1." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Reports,
});

type Order = {
  id: string; order_number: number; created_at: string; type: string; source: string | null;
  status: string; payment_status: string; payment_method: string | null;
  subtotal_cents: number; discount_cents: number; promo_discount_cents: number;
  voucher_cents: number; delivery_fee_cents: number; total_cents: number;
  customer_name: string; driver_id: string | null;
};
type Item = { order_id: string; name: string; qty: number; unit_price_cents: number };

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function Reports() {
  const { user, loading } = useSession();
  const { has, loading: rolesLoading } = useRoles(user);
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [drivers, setDrivers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/admin/login", search: { next: "/admin/reports" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const from = isoDaysAgo(days - 1).toISOString();
      const { data: o } = await supabase
        .from("orders")
        .select("id, order_number, created_at, type, source, status, payment_status, payment_method, subtotal_cents, discount_cents, promo_discount_cents, voucher_cents, delivery_fee_cents, total_cents, customer_name, driver_id")
        .gte("created_at", from)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const rows = (o ?? []) as Order[];
      setOrders(rows);
      const ids = rows.map((r) => r.id);
      if (ids.length) {
        const { data: it } = await supabase
          .from("order_items")
          .select("order_id, name, qty, unit_price_cents")
          .in("order_id", ids);
        if (!cancelled) setItems((it ?? []) as Item[]);
      } else setItems([]);
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email");
      if (!cancelled) {
        setDrivers(Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name || p.email || p.id.slice(0, 6)])));
      }
    })();
    return () => { cancelled = true; };
  }, [user, days]);

  const counted = useMemo(
    () => orders.filter((o) => o.status !== "cancelled" && o.payment_status !== "refunded"),
    [orders],
  );

  const totals = useMemo(() => {
    const gross = counted.reduce((s, o) => s + o.total_cents, 0);
    return {
      gross,
      orders: counted.length,
      avg: counted.length ? Math.round(gross / counted.length) : 0,
      discounts: counted.reduce((s, o) => s + o.discount_cents, 0),
      vouchers: counted.reduce((s, o) => s + o.voucher_cents, 0),
      delivery: counted.reduce((s, o) => s + o.delivery_fee_cents, 0),
      refunded: orders.filter((o) => o.payment_status === "refunded").reduce((s, o) => s + o.total_cents, 0),
    };
  }, [counted, orders]);

  const byDay = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (let i = days - 1; i >= 0; i--) {
      map.set(isoDaysAgo(i).toDateString(), { total: 0, count: 0 });
    }
    for (const o of counted) {
      const k = new Date(o.created_at).toDateString();
      const cur = map.get(k);
      if (cur) { cur.total += o.total_cents; cur.count += 1; }
    }
    return [...map.entries()];
  }, [counted, days]);

  const maxDay = Math.max(1, ...byDay.map(([, v]) => v.total));

  const split = useMemo(() => {
    const by = (key: (o: Order) => string) => {
      const m = new Map<string, { count: number; total: number }>();
      for (const o of counted) {
        const k = key(o);
        const cur = m.get(k) ?? { count: 0, total: 0 };
        cur.count++; cur.total += o.total_cents;
        m.set(k, cur);
      }
      return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
    };
    return {
      type: by((o) => (o.type === "collection" ? "Pickup" : o.type.replace("_", " "))),
      source: by((o) => o.source || "website"),
      payment: by((o) => (o.payment_status === "on_account" ? "tab" : o.payment_method || "card")),
    };
  }, [counted]);

  const topItems = useMemo(() => {
    const live = new Set(counted.map((o) => o.id));
    const m = new Map<string, { qty: number; revenue: number }>();
    for (const it of items) {
      if (!live.has(it.order_id)) continue;
      const cur = m.get(it.name) ?? { qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.qty * it.unit_price_cents;
      m.set(it.name, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 15);
  }, [items, counted]);

  const byDriver = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of counted) {
      if (o.type !== "delivery" || !o.driver_id) continue;
      m.set(o.driver_id, (m.get(o.driver_id) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [counted]);

  function exportCsv() {
    const head = [
      "order_number", "created_at", "type", "source", "status", "payment_status", "payment_method",
      "customer_name", "subtotal", "discount", "voucher", "delivery_fee", "total",
    ];
    const rows = orders.map((o) => [
      o.order_number,
      new Date(o.created_at).toISOString(),
      o.type, o.source ?? "website", o.status, o.payment_status, o.payment_method ?? "",
      `"${(o.customer_name ?? "").replace(/"/g, '""')}"`,
      (o.subtotal_cents / 100).toFixed(2),
      (o.discount_cents / 100).toFixed(2),
      (o.voucher_cents / 100).toFixed(2),
      (o.delivery_fee_cents / 100).toFixed(2),
      (o.total_cents / 100).toFixed(2),
    ]);
    const csv = [head.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cafe1-sales-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!rolesLoading && user && !has("admin") && !has("staff")) {
    return <div className="p-10 text-center text-muted-foreground">Not authorised.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-3xl font-bold">Sales reports</h1>
              <p className="text-sm text-muted-foreground">Cancelled and refunded orders are excluded from totals.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[1, 7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${days === d ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:border-primary"}`}
              >
                {d === 1 ? "Today" : `${d} days`}
              </button>
            ))}
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Revenue", value: money(totals.gross) },
            { label: "Orders", value: String(totals.orders) },
            { label: "Average order", value: money(totals.avg) },
            { label: "Delivery fees", value: money(totals.delivery) },
            { label: "Discounts given", value: money(totals.discounts) },
            { label: "Voucher spend", value: money(totals.vouchers) },
            { label: "Refunded", value: money(totals.refunded) },
            { label: "Deliveries", value: String(counted.filter((o) => o.type === "delivery").length) },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <p className="mt-1 font-display text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl font-bold">Daily takings</h2>
          <div className="mt-4 flex h-40 items-end gap-1.5">
            {byDay.map(([day, v]) => (
              <div key={day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${day}: ${money(v.total)} · ${v.count} orders`}>
                <span className="text-[10px] font-semibold text-muted-foreground">{v.total ? money(v.total) : ""}</span>
                <div className="w-full rounded-t bg-primary" style={{ height: `${Math.max(2, (v.total / maxDay) * 100)}%` }} />
                <span className="text-[10px] text-muted-foreground">{new Date(day).toLocaleDateString("en-GB", { weekday: "short" })}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {([
            ["Order type", split.type],
            ["Channel", split.source],
            ["Payment", split.payment],
          ] as const).map(([title, rows]) => (
            <section key={title} className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold">{title}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {rows.map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between capitalize">
                    <span>{k.replace(/_/g, " ")} <span className="text-xs text-muted-foreground">×{v.count}</span></span>
                    <span className="font-semibold">{money(v.total)}</span>
                  </li>
                ))}
                {!rows.length && <li className="text-muted-foreground">No data.</li>}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">Top items</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {topItems.map(([name, v]) => (
                <li key={name} className="flex items-center justify-between gap-3">
                  <span className="truncate">{name}</span>
                  <span className="shrink-0 text-muted-foreground">×{v.qty} · <span className="font-semibold text-foreground">{money(v.revenue)}</span></span>
                </li>
              ))}
              {!topItems.length && <li className="text-muted-foreground">No data.</li>}
            </ul>
          </section>
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">Deliveries by driver</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {byDriver.map(([id, n]) => (
                <li key={id} className="flex items-center justify-between">
                  <span>{drivers[id] ?? id.slice(0, 6)}</span>
                  <span className="font-semibold">{n}</span>
                </li>
              ))}
              {!byDriver.length && <li className="text-muted-foreground">No deliveries yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
