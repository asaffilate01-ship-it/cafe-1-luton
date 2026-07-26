import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";

type Order = {
  id: string; order_number: number; type: string; status: string;
  customer_name: string; customer_phone: string; created_at: string;
  address_line1: string | null; city: string | null; postcode: string | null;
  delivery_notes: string | null; total_cents: number; subtotal_cents: number;
  delivery_fee_cents: number;
  company_name: string | null; table_number: string | null;
  schedule_mode: string | null; scheduled_for: string | null;
};
type Item = { id: string; name: string; qty: number; notes: string | null; unit_price_cents: number };

export const Route = createFileRoute("/print/$orderId")({
  head: () => ({
    meta: [{ title: "Ticket — Cafe1" }, { name: "robots", content: "noindex" }],
  }),
  component: PrintPage,
});

function PrintPage() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [paper, setPaper] = useState<58 | 80>(58);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("cafe1_paper_mm") : null;
    if (saved === "80") setPaper(80);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    window.localStorage.setItem("cafe1_paper_mm", String(paper));
    const id = "cafe1-paper-size";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `@page { size: ${paper}mm auto; margin: 0; }
@media print { html, body, .ticket-page { width: ${paper}mm !important; max-width: ${paper}mm !important; } }`;
  }, [paper]);

  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: its }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
        supabase.from("order_items").select("id, name, qty, notes, unit_price_cents").eq("order_id", orderId),
      ]);
      setOrder((o as unknown) as Order | null);
      setItems((its ?? []) as Item[]);
    })();
  }, [orderId]);

  useEffect(() => {
    if (order) setTimeout(() => window.print(), 400);
  }, [order]);

  if (!order) return <div className="p-6">Loading…</div>;

  const copies = [
    { label: "KITCHEN COPY", showPrices: false },
    { label: "COUNTER COPY", showPrices: true },
  ];

  return (
    <div style={{ fontFamily: "monospace" }} className="bg-white text-black">
      <div className="no-print flex flex-wrap items-center gap-3 p-4 text-sm">
        <button onClick={() => window.print()} className="rounded bg-primary px-4 py-2 font-semibold text-primary-foreground">Print again</button>
        <div className="flex items-center gap-1 rounded-full border border-border p-1">
          {[58, 80].map((w) => (
            <button
              key={w}
              onClick={() => setPaper(w as 58 | 80)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${paper === w ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {w}mm
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">iMin D4-504 built-in printer uses 58mm</span>
      </div>
      {copies.map((copy) => (
        <section
          key={copy.label}
          className="ticket-page mx-auto p-4 text-[13px] leading-snug"
          style={{ maxWidth: paper === 58 ? 240 : 320 }}
        >
          <div className="text-center">
            <p className="text-lg font-bold">CAFE1</p>
            <p className="text-xs">{copy.label}</p>
            <p className="mt-1 text-xs">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <div className="my-2 border-t border-dashed border-black" />
          <p><b>Order #{order.order_number}</b></p>
          <div className="my-1 border-2 border-black px-1 py-1 text-center">
            <p className="text-[22px] font-black leading-tight">
              {order.type === "dine_in" ? "DINE IN" : order.type === "collection" ? "PICKUP" : "DELIVERY"}
            </p>
            <p className="text-[18px] font-black leading-tight">
              {order.schedule_mode === "scheduled" && order.scheduled_for
                ? `FOR ${new Date(order.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "ASAP"}
            </p>
            {order.schedule_mode === "scheduled" && order.scheduled_for && (
              <p className="text-[11px] font-bold">{new Date(order.scheduled_for).toLocaleDateString()}</p>
            )}
            {order.type === "dine_in" && order.table_number && (
              <p className="text-[16px] font-black leading-tight">TABLE {order.table_number}</p>
            )}
          </div>
          <p>{order.customer_name} · {order.customer_phone}</p>
          {order.type === "delivery" && (
            <p className="mt-1 text-xs">
              {order.company_name && <>{order.company_name}<br /></>}
              {[order.address_line1, order.city, order.postcode].filter(Boolean).join(", ")}
              {order.delivery_notes && <><br />NOTE: {order.delivery_notes}</>}
            </p>
          )}
          <div className="my-2 border-t border-dashed border-black" />
          <ul>
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span><b>{i.qty}×</b> {i.name}{i.notes ? ` (${i.notes})` : ""}</span>
                {copy.showPrices && <span>{money(i.unit_price_cents * i.qty)}</span>}
              </li>
            ))}
          </ul>
          {copy.showPrices && (
            <>
              <div className="my-2 border-t border-dashed border-black" />
              <div className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotal_cents)}</span></div>
              {order.delivery_fee_cents > 0 && <div className="flex justify-between"><span>Delivery</span><span>{money(order.delivery_fee_cents)}</span></div>}
              <div className="flex justify-between font-bold"><span>TOTAL</span><span>{money(order.total_cents)}</span></div>
            </>
          )}
          <div className="my-2 border-t border-dashed border-black" />
          <p className="text-center text-xs">Thank you!</p>
        </section>
      ))}
    </div>
  );
}