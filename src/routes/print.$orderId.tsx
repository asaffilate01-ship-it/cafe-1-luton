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
      <div className="no-print p-4 text-sm">
        <button onClick={() => window.print()} className="rounded bg-primary px-4 py-2 font-semibold text-primary-foreground">Print again</button>
      </div>
      {copies.map((copy) => (
        <section key={copy.label} className="ticket-page mx-auto max-w-[320px] p-4 text-[13px] leading-snug">
          <div className="text-center">
            <p className="text-lg font-bold">CAFE1</p>
            <p className="text-xs">{copy.label}</p>
            <p className="mt-1 text-xs">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <div className="my-2 border-t border-dashed border-black" />
          <p><b>Order #{order.order_number}</b> · {order.type.replace("_", " ").toUpperCase()}</p>
          <p>{order.customer_name} · {order.customer_phone}</p>
          <p className="text-xs">
            {order.schedule_mode === "scheduled" && order.scheduled_for
              ? `FOR: ${new Date(order.scheduled_for).toLocaleString()}`
              : "ASAP"}
          </p>
          {order.type === "dine_in" && order.table_number && (
            <p className="text-xs">TABLE: {order.table_number}</p>
          )}
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