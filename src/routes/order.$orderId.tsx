import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Bell, Navigation } from "lucide-react";
import { LiveMap } from "@/components/live-map";

const STORE = { lat: 51.7486, lng: -0.3345 };

type DriverLoc = { lat: number; lng: number; updated_at: string };

function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

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

const DELIVERY_STEPS = ["pending_payment", "paid", "preparing", "ready", "out_for_delivery", "delivered"] as const;
const COUNTER_STEPS = ["pending_payment", "paid", "preparing", "ready", "completed"] as const;
const STEP_LABELS: Record<string, string> = {
  pending_payment: "Placed",
  paid: "Awaiting accept",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "On the way",
  delivered: "Delivered",
  completed: "Collected",
};

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  paid: { title: "Payment received", body: "We've got your payment — waiting for the café to accept." },
  preparing: { title: "Order accepted 👩‍🍳", body: "Cafe1 is preparing your order now." },
  ready: { title: "Ready ☕", body: "Your order is ready." },
  out_for_delivery: { title: "On the way 🚴", body: "Your driver has picked up your order." },
  delivered: { title: "Delivered ✅", body: "Enjoy! Thanks for ordering from Cafe1." },
  completed: { title: "All done ✅", body: "Thanks for ordering from Cafe1." },
  cancelled: { title: "Order cancelled", body: "Your order was cancelled. Contact us if this was a mistake." },
};

function OrderView() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [driverLoc, setDriverLoc] = useState<DriverLoc | null>(null);
  const [items, setItems] = useState<Array<{ id: string; name: string; qty: number; unit_price_cents: number }>>([]);
  const lastStatus = useRef<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  function notify(status: string) {
    const msg = STATUS_MESSAGES[status];
    if (!msg) return;
    toast.success(msg.title, { description: msg.body });
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(`Cafe1 · ${msg.title}`, { body: msg.body, icon: "/icon-512.png", tag: `order-${orderId}` });
      } catch { /* noop */ }
    }
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      const o = (data as unknown) as Order | null;
      if (o && lastStatus.current && lastStatus.current !== o.status) notify(o.status);
      if (o) lastStatus.current = o.status;
      setOrder(o);
      const { data: its } = await supabase.from("order_items").select("*").eq("order_id", orderId);
      setItems(its ?? []);
    }
    load();
    const ch = supabase
      .channel(`order-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const tracking = order?.type === "delivery" && order.status === "out_for_delivery";

  useEffect(() => {
    if (!tracking) { setDriverLoc(null); return; }
    async function loadLoc() {
      const { data } = await supabase
        .from("driver_locations")
        .select("lat, lng, updated_at")
        .eq("order_id", orderId)
        .maybeSingle();
      setDriverLoc((data as DriverLoc | null) ?? null);
    }
    loadLoc();
    const ch = supabase
      .channel(`driver-loc-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const row = payload.new as DriverLoc | undefined;
          if (row?.lat != null) setDriverLoc(row);
        },
      )
      .subscribe();
    const poll = setInterval(loadLoc, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [orderId, tracking]);

  if (!order) return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-md p-12 text-center text-muted-foreground">Loading order…</div>
    </div>
  );

  const steps = order.type === "delivery" ? DELIVERY_STEPS : COUNTER_STEPS;
  const stepIdx = Math.max(0, (steps as readonly string[]).indexOf(order.status));
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

        {notifPerm === "default" && (
          <button
            type="button"
            onClick={async () => {
              const p = await Notification.requestPermission();
              setNotifPerm(p);
              if (p === "granted") toast.success("Notifications on — we'll ping you when your order moves.");
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            <Bell className="h-4 w-4" /> Turn on order updates
          </button>
        )}

        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((s, idx) => (
              <div key={s} className="text-center">
                <div className={`mx-auto h-2 rounded-full ${idx <= stepIdx ? "bg-primary" : "bg-border"}`} />
                <p className={`mt-2 text-[10px] uppercase tracking-wider ${idx <= stepIdx ? "text-primary font-semibold" : "text-muted-foreground"}`}>{STEP_LABELS[s] ?? s}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Payment: <span className="font-semibold text-foreground">{order.payment_status}</span></p>
        </div>

        {tracking && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary">
                  <Navigation className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold">Live delivery tracking</p>
                  <p className="text-xs text-muted-foreground">
                    {driverLoc
                      ? `Driver updated ${new Date(driverLoc.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Waiting for your driver to go live…"}
                  </p>
                </div>
              </div>
              {driverLoc && (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {(() => {
                    const m = metresBetween(driverLoc, STORE);
                    return m < 950 ? `${Math.round(m)} m from the café` : `${(m / 1609).toFixed(1)} mi from the café`;
                  })()}
                </span>
              )}
            </div>
            {driverLoc ? (
              <LiveMap
                className="mt-4 h-64 w-full"
                points={[
                  { lat: driverLoc.lat, lng: driverLoc.lng, label: "Your driver", kind: "driver" },
                  { ...STORE, label: "Café 1", kind: "store" },
                ]}
              />
            ) : (
              <div className="mt-4 grid h-24 place-items-center rounded-xl bg-secondary text-sm text-muted-foreground">
                The map appears as soon as the driver starts sharing location.
              </div>
            )}
          </div>
        )}

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