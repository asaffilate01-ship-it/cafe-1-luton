import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { money } from "@/lib/format";

type Order = {
  id: string;
  order_number: number;
  status: string;
  payment_status: string;
  type: string;
  total_cents: number;
  customer_name: string;
  created_at: string;
  scheduled_for: string | null;
  schedule_mode: string | null;
};

export const Route = createFileRoute("/order/$orderId")({
  head: () => ({
    meta: [
      { title: "Order status — Cafe1" },
      { name: "description", content: "Track the status of your Cafe1 order in real time." },
      { property: "og:title", content: "Order status — Cafe1" },
      { property: "og:description", content: "Track your Cafe1 order in real time." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderView,
});

const STEPS = ["pending_payment", "paid", "preparing", "ready", "out_for_delivery", "delivered"] as const;

function OrderView() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Array<{ id: string; name: string; qty: number; unit_price_cents: number }>>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      setOrder((data as unknown) as Order | null);
      const { data: its } = await supabase.from("order_items").select("*").eq("order_id", orderId);
      setItems(its ?? []);
    }
    load();
    const ch = supabase
      .channel(`order-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  if (!order) return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-md p-12 text-center text-muted-foreground">Loading order…</div>
    </div>
  );

  const stepIdx = Math.max(0, STEPS.indexOf(order.status as (typeof STEPS)[number]));
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm uppercase tracking-wider text-muted-foreground">Order</p>
        <h1 className="font-display text-4xl font-bold">#{order.order_number}</h1>
        <p className="mt-1 text-muted-foreground">
          {order.customer_name} · {order.type === "collection" ? "Pickup" : order.type.replace("_", " ")}
          {" · "}
          {order.schedule_mode === "scheduled" && order.scheduled_for
            ? `for ${new Date(order.scheduled_for).toLocaleString([], { hour: "2-digit", minute: "2-digit", weekday: "short" })}`
            : "ASAP"}
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="grid grid-cols-6 gap-2">
            {STEPS.map((s, idx) => (
              <div key={s} className="text-center">
                <div className={`mx-auto h-2 rounded-full ${idx <= stepIdx ? "bg-primary" : "bg-border"}`} />
                <p className={`mt-2 text-[10px] uppercase tracking-wider ${idx <= stepIdx ? "text-primary font-semibold" : "text-muted-foreground"}`}>{s.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Payment: <span className="font-semibold text-foreground">{order.payment_status}</span></p>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <ul className="divide-y divide-border text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between py-2"><span>{i.qty} × {i.name}</span><span>{money(i.unit_price_cents * i.qty)}</span></li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-border pt-3 font-display text-lg font-bold"><span>Total</span><span className="text-primary">{money(order.total_cents)}</span></div>
        </div>

        <div className="mt-6 flex gap-2">
          <Link to="/menu" className="h-11 flex-1 rounded-full border border-border bg-card text-center font-semibold leading-[2.75rem] hover:border-primary">Order more</Link>
          <Link to="/account" className="h-11 flex-1 rounded-full bg-primary text-center font-semibold leading-[2.75rem] text-primary-foreground hover:bg-primary-hover">My orders</Link>
        </div>
      </div>
    </div>
  );
}