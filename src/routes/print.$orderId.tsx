import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import { orderCode } from "@/lib/order-code";

type Order = {
  id: string;
  order_number: number;
  type: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  created_at: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  delivery_notes: string | null;
  total_cents: number;
  subtotal_cents: number;
  delivery_fee_cents: number;
  discount_cents: number;
  voucher_cents: number;
  company_name: string | null;
  table_number: string | null;
  schedule_mode: string | null;
  scheduled_for: string | null;
  source?: string | null;
  pos_terminal?: string | null;
};
type Item = {
  id: string;
  name: string;
  qty: number;
  notes: string | null;
  unit_price_cents: number;
};

export const Route = createFileRoute("/print/$orderId")({
  validateSearch: (s: Record<string, unknown>) => ({
    paper:
      s.paper === "80" || s.paper === 80
        ? (80 as const)
        : s.paper === "58" || s.paper === 58
          ? (58 as const)
          : undefined,
    preview: s.preview === "1" || s.preview === 1 || s.preview === true ? true : undefined,
    type:
      s.type === "dine_in" || s.type === "collection" || s.type === "delivery"
        ? (s.type as "dine_in" | "collection" | "delivery")
        : undefined,
  }),
  head: () => ({
    meta: [{ title: "Ticket — Cafe1" }, { name: "robots", content: "noindex" }],
  }),
  component: PrintPage,
});

const SAMPLE_TYPES = [
  { value: "dine_in", label: "Dine in" },
  { value: "collection", label: "Pickup" },
  { value: "delivery", label: "Delivery" },
] as const;

function sampleOrder(
  type: "dine_in" | "collection" | "delivery",
  scheduled: boolean,
): { order: Order; items: Item[] } {
  const now = new Date();
  const slot = new Date(now.getTime() + 45 * 60000);
  return {
    order: {
      id: "test",
      order_number: 9999,
      type,
      status: "preparing",
      customer_name: "TEST PRINT",
      customer_phone: "07000 000000",
      created_at: now.toISOString(),
      address_line1: "Crown Court, Civic Close",
      address_line2: "Office 4, 2nd floor",
      city: "Luton",
      postcode: "LU1 2AA",
      delivery_notes: type === "delivery" ? "Reception desk, ask for Sam" : null,
      subtotal_cents: 1490,
      delivery_fee_cents: type === "delivery" ? 0 : 0,
      total_cents: 1490,
      discount_cents: 0,
      voucher_cents: 0,
      company_name: type === "delivery" ? "Sample Offices Ltd" : null,
      table_number: type === "dine_in" ? "12" : null,
      schedule_mode: scheduled ? "scheduled" : "asap",
      scheduled_for: scheduled ? slot.toISOString() : null,
      source: "web",
      pos_terminal: null,
    },
    items: [
      { id: "t1", name: "Flat White", qty: 2, notes: "Oat milk, extra hot", unit_price_cents: 320 },
      { id: "t2", name: "Jacket Potato", qty: 1, notes: "Cheese + beans", unit_price_cents: 650 },
      { id: "t3", name: "Bacon Roll", qty: 1, notes: null, unit_price_cents: 200 },
    ],
  };
}

function PrintPage() {
  const { orderId } = Route.useParams();
  const { paper: paperParam, preview, type: typeParam } = Route.useSearch();
  const isTest = orderId === "test";
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [paper, setPaper] = useState<58 | 80>(58);
  const [sampleType, setSampleType] = useState<"dine_in" | "collection" | "delivery">(
    typeParam ?? "delivery",
  );
  const [sampleScheduled, setSampleScheduled] = useState(false);

  useEffect(() => {
    if (paperParam) {
      setPaper(paperParam);
      return;
    }
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem("cafe1_paper_mm") : null;
    if (saved === "80") setPaper(80);
  }, [paperParam]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!paperParam) window.localStorage.setItem("cafe1_paper_mm", String(paper));
    const id = "cafe1-paper-size";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `@page { size: ${paper}mm auto; margin: 0; }
@media print { html, body, .ticket-page { width: ${paper}mm !important; max-width: ${paper}mm !important; } }`;
  }, [paper, paperParam]);

  useEffect(() => {
    if (isTest) {
      const s = sampleOrder(sampleType, sampleScheduled);
      setOrder(s.order);
      setItems(s.items);
      return;
    }
    (async () => {
      const [{ data: o }, { data: its }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
        supabase
          .from("order_items")
          .select("id, name, qty, notes, unit_price_cents")
          .eq("order_id", orderId),
      ]);
      setOrder(o as unknown as Order | null);
      setItems((its ?? []) as Item[]);
    })();
  }, [orderId, isTest, sampleType, sampleScheduled]);

  useEffect(() => {
    if (order && !preview && !isTest) setTimeout(() => window.print(), 400);
  }, [order, preview, isTest]);

  if (!order) return <div className="p-6">Loading…</div>;

  const copies = [
    { label: "KITCHEN COPY", showPrices: false },
    { label: "COUNTER COPY", showPrices: true },
  ];

  return (
    <div style={{ fontFamily: "monospace" }} className="bg-white text-black">
      <div className="no-print flex flex-wrap items-center gap-3 p-4 text-sm">
        <button
          onClick={() => window.print()}
          className="rounded bg-primary px-4 py-2 font-semibold text-primary-foreground"
        >
          {isTest ? "Send test print" : preview ? "Print ticket" : "Print again"}
        </button>
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
        {isTest && (
          <>
            <div className="flex items-center gap-1 rounded-full border border-border p-1">
              {SAMPLE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSampleType(t.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${sampleType === t.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={sampleScheduled}
                onChange={(e) => setSampleScheduled(e.target.checked)}
              />
              Scheduled slot (instead of ASAP)
            </label>
          </>
        )}
        <span className="text-xs text-muted-foreground">
          iMin D4-504 built-in printer uses 58mm
        </span>
        {isTest && (
          <span className="w-full rounded-lg bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">
            Test ticket — sample data only, no order is created. Print it to check paper width,
            header and formatting on this device.
          </span>
        )}
        {preview && !isTest && (
          <span className="w-full text-xs text-muted-foreground">
            Preview mode — nothing prints until you press the button.
          </span>
        )}
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
          <p>
            <b>Order #{order.order_number}</b>
          </p>
          <p className="text-center text-[16px] font-black tracking-widest">
            CODE {orderCode(order)}
          </p>
          <div className="my-1 border-2 border-black px-1 py-1 text-center">
            <p className="text-[22px] font-black leading-tight">
              {order.type === "dine_in"
                ? "DINE IN"
                : order.type === "collection"
                  ? "PICKUP"
                  : "DELIVERY"}
            </p>
            <p className="text-[18px] font-black leading-tight">
              {order.schedule_mode === "scheduled" && order.scheduled_for
                ? `FOR ${new Date(order.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "ASAP"}
            </p>
            {order.schedule_mode === "scheduled" && order.scheduled_for && (
              <p className="text-[11px] font-bold">
                {new Date(order.scheduled_for).toLocaleDateString()}
              </p>
            )}
            {order.type === "dine_in" && order.table_number && (
              <p className="text-[16px] font-black leading-tight">TABLE {order.table_number}</p>
            )}
          </div>
          <p className="text-[15px] font-black uppercase leading-tight">{order.customer_name}</p>
          {(order.pos_terminal === "jury" ||
            order.pos_terminal === "judge" ||
            order.pos_terminal === "public") && (
            <p className="mt-1 border-2 border-black px-1 py-1 text-center text-[20px] font-black uppercase tracking-widest leading-tight">
              {order.pos_terminal === "public" ? "PUBLIC SIDE" : order.pos_terminal.toUpperCase()}
            </p>
          )}
          <p className="text-[11px]">{order.customer_phone}</p>
          {order.source === "deliveroo" && (
            <p className="mt-1 border-2 border-black px-1 py-1 text-center text-[13px] font-black uppercase leading-tight">
              Attach Deliveroo receipt from tablet
            </p>
          )}
          {order.type === "delivery" && (
            <div className="mt-1 border border-black px-1 py-1 text-xs">
              <p className="text-[10px] font-bold">DELIVER TO</p>
              {order.postcode && (
                <p className="text-[18px] font-black leading-tight">{order.postcode}</p>
              )}
              {order.company_name && <p className="font-bold">{order.company_name}</p>}
              {order.address_line1 && <p>{order.address_line1}</p>}
              {order.address_line2 && <p>{order.address_line2}</p>}
              {order.city && <p>{order.city}</p>}
              {order.delivery_notes && <p className="font-bold">NOTE: {order.delivery_notes}</p>}
            </div>
          )}
          <div className="my-2 border-t border-dashed border-black" />
          <ul>
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span>
                  <b>{i.qty}×</b> {i.name}
                  {i.notes ? ` (${i.notes})` : ""}
                </span>
                {copy.showPrices && <span>{money(i.unit_price_cents * i.qty)}</span>}
              </li>
            ))}
          </ul>
          {copy.showPrices && (
            <>
              <div className="my-2 border-t border-dashed border-black" />
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{money(order.subtotal_cents)}</span>
              </div>
              {order.discount_cents > 0 && (
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>−{money(order.discount_cents)}</span>
                </div>
              )}
              {order.delivery_fee_cents > 0 && (
                <div className="flex justify-between">
                  <span>Delivery</span>
                  <span>{money(order.delivery_fee_cents)}</span>
                </div>
              )}
              {order.voucher_cents > 0 && (
                <div className="flex justify-between font-bold">
                  <span>COURT VOUCHER</span>
                  <span>−{money(order.voucher_cents)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>{order.voucher_cents > 0 ? "TO PAY" : "TOTAL"}</span>
                <span>{money(order.total_cents)}</span>
              </div>
            </>
          )}
          <div className="my-2 border-t border-dashed border-black" />
          <p className="text-center text-xs">Thank you!</p>
        </section>
      ))}
    </div>
  );
}
