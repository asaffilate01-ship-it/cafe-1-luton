import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createOrder } from "@/lib/orders.functions";
import { cart, useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { SiteHeader } from "@/components/site-header";
import { useSession } from "@/hooks/use-auth";
import { tab, useTab } from "@/lib/tab";
import { toast } from "sonner";
import { useStoreStatus } from "@/hooks/use-store-status";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Cafe1" },
      { name: "description", content: "Complete your Cafe1 order — pay securely with SumUp." },
      { property: "og:title", content: "Checkout — Cafe1" },
      { property: "og:description", content: "Complete your Cafe1 order — pay securely with SumUp." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

type Mode = "delivery" | "collection" | "dine_in";
type ScheduleMode = "asap" | "scheduled";

function buildTimeSlots(): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = [];
  const now = new Date();
  const start = new Date(now.getTime() + 30 * 60 * 1000);
  // round up to next 15 minutes
  const m = start.getMinutes();
  start.setMinutes(m + ((15 - (m % 15)) % 15), 0, 0);
  for (let i = 0; i < 24; i++) {
    const d = new Date(start.getTime() + i * 15 * 60 * 1000);
    slots.push({
      value: d.toISOString(),
      label: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  }
  return slots;
}

function Checkout() {
  const c = useCart();
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const tabSession = useTab();
  const { status, settings } = useStoreStatus();
  const place = useServerFn(createOrder);
  const [mode, setMode] = useState<Mode>("collection");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("asap");
  const [scheduledFor, setScheduledFor] = useState<string>("");
  const timeSlots = useState(() => buildTimeSlots())[0];
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<null | { code: string; discount_cents: number; discount_type: string; message: string | null }>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    company_name: "",
    address_line1: "",
    city: "",
    postcode: "",
    delivery_notes: "",
    table_number: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.email && !form.customer_email)
      setForm((f) => ({ ...f, customer_email: user.email ?? "" }));
  }, [user, form.customer_email]);

  const subtotal = c.items.reduce((s, i) => s + i.price_cents * i.qty, 0);
  const baseDelivery = settings?.delivery_fee_cents ?? 299;
  const freeThreshold = settings?.free_delivery_threshold_cents ?? null;
  const freeDeliveryByThreshold = mode === "delivery" && !!freeThreshold && subtotal >= (freeThreshold ?? 0);
  const freeDeliveryByPromo = promo?.discount_type === "free_delivery";
  const delivery = mode === "delivery" && !freeDeliveryByThreshold && !freeDeliveryByPromo ? baseDelivery : 0;
  const onTab = !!tabSession;
  const loyaltyDiscount = user && !onTab ? Math.round(subtotal * 0.1) : 0;
  const promoDiscount = promo && !freeDeliveryByPromo ? Math.min(promo.discount_cents, subtotal) : 0;
  const discount = Math.min(subtotal, loyaltyDiscount + promoDiscount);
  const total = Math.max(0, subtotal - discount) + delivery;
  const pointsEarn = user && !onTab ? Math.floor(Math.max(0, subtotal - discount) / 100) : 0;
  const minOrder = settings?.min_order_cents ?? 0;
  const belowMin = minOrder > 0 && subtotal < minOrder;
  const storeBlocks = !status.open && !(settings?.allow_preorder_when_closed && scheduleMode === "scheduled");
  // Prevent unused import warning when navigate not used
  void navigate;

  async function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoBusy(true);
    const { data, error } = await supabase.rpc("validate_promo_code", {
      _code: code, _subtotal_cents: subtotal, _order_type: mode,
    });
    setPromoBusy(false);
    const row = (data ?? [])[0];
    if (error || !row || !row.valid) {
      toast.error(row?.message || error?.message || "That code isn't valid.");
      setPromo(null);
      return;
    }
    setPromo({ code: row.code, discount_cents: row.discount_cents ?? 0, discount_type: row.discount_type, message: row.message });
    toast.success(row.message || "Promo applied");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!c.items.length) return;
    setBusy(true);
    try {
      const res = await place({
        data: {
          type: mode,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_email: form.customer_email,
          company_name: mode === "delivery" ? form.company_name || undefined : undefined,
          address_line1: mode === "delivery" ? form.address_line1 : undefined,
          city: mode === "delivery" ? form.city : undefined,
          postcode: mode === "delivery" ? form.postcode : undefined,
          delivery_notes: form.delivery_notes || undefined,
          table_number: mode === "dine_in" ? form.table_number || undefined : undefined,
          schedule_mode: scheduleMode,
          scheduled_for: scheduleMode === "scheduled" ? scheduledFor || undefined : undefined,
          items: c.items.map((i) => ({
            menu_item_id: i.menu_item_id,
            qty: i.qty,
            notes: i.notes,
            modifier_ids: i.modifiers?.map((m) => m.id),
          })),
          account_code: tabSession?.code,
          promo_code: promo?.code,
        },
      });
      cart.clear();
      if (res.on_tab) {
        toast.success(`Added to ${tabSession?.name}'s tab`);
        navigate({ to: "/order/$orderId", params: { orderId: res.order_id } });
      } else {
        // Send them to the on-site card payment page.
        navigate({ to: "/pay/$orderId", params: { orderId: res.order_id } });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Order failed");
    } finally {
      setBusy(false);
    }
  }

  if (!c.items.length)
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-md px-4 py-24 text-center text-muted-foreground">Your basket is empty.</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-12 lg:grid-cols-[1fr_360px]">
        <form id="checkout-form" onSubmit={submit} className="space-y-6">
          {!status.open && (
            <div className={`rounded-2xl border p-4 text-sm ${settings?.allow_preorder_when_closed ? "border-amber-500/40 bg-amber-500/10 text-amber-900" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
              <p className="font-semibold">
                {settings?.closed_message || "We're currently closed."}
                {status.nextOpenLabel && <span className="ml-1 font-normal opacity-80">Opens {status.nextOpenLabel}.</span>}
              </p>
              {settings?.allow_preorder_when_closed && (
                <p className="mt-1 opacity-90">You can still pre-order — pick “Schedule for later” below.</p>
              )}
            </div>
          )}
          {tabSession && (
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
              <div>
                <p className="font-semibold text-primary">Charging to {tabSession.name}'s tab</p>
                <p className="mt-1 text-muted-foreground">This order will be added to the running bill — no payment now.</p>
              </div>
              <button type="button" onClick={() => tab.clear()} className="rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20">Leave tab</button>
            </div>
          )}
          {!user && !loading && !tabSession && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <p className="font-semibold text-primary">Get 10% off & earn loyalty points</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <Link to="/auth" search={{ next: "/checkout" }} className="font-semibold text-primary underline">Sign in or create an account</Link>{" "}
                to unlock member pricing and earn 1 point per £1 — or continue as guest below.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Got a business tab code? <Link to="/tab" className="font-semibold text-primary underline">Sign in with your account code</Link>.
              </p>
            </div>
          )}
          {user && !tabSession && (
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
              <span className="font-semibold text-primary">Member perks applied</span> — 10% off this order and you'll earn {pointsEarn} points.
            </div>
          )}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-semibold">How would you like your order?</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["collection", "delivery", "dine_in"] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMode(m)}
                  className={`h-11 rounded-xl border text-sm font-semibold capitalize transition ${
                    mode === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary"
                  }`}
                >
                  {m === "collection" ? "Pickup" : m === "dine_in" ? "Dine in" : "Delivery"}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-semibold">When?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["asap", "scheduled"] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setScheduleMode(s)}
                  className={`h-11 rounded-xl border text-sm font-semibold transition ${
                    scheduleMode === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary"
                  }`}
                >
                  {s === "asap" ? "ASAP" : "Schedule for later"}
                </button>
              ))}
            </div>
            {scheduleMode === "scheduled" && (
              <select
                required
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4"
              >
                <option value="">Select a time slot…</option>
                {timeSlots.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-semibold">Your details</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input required placeholder="Contact person's name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
              <input required placeholder="Phone" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
              <input type="email" placeholder="Email (optional)" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4 sm:col-span-2" />
            </div>
          </div>

          {mode === "dine_in" && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="font-semibold">Table</p>
              <input placeholder="Table number (optional)" value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4" />
            </div>
          )}

          {mode === "delivery" && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="font-semibold">Delivery address</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input required placeholder="Postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
                <input placeholder="Office / company name (optional)" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
                <input required placeholder="Street address" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4 sm:col-span-2" />
                <input required placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
                <textarea placeholder="Delivery notes — buzzer, floor, gate code (optional)" value={form.delivery_notes} onChange={(e) => setForm({ ...form, delivery_notes: e.target.value })} className="min-h-20 rounded-xl border border-border bg-background p-3 sm:col-span-2" />
              </div>
            </div>
          )}
        </form>

        <aside className="h-fit rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold">Order summary</p>
          <ul className="mt-3 divide-y divide-border text-sm">
            {c.items.map((i) => (
              <li key={i.id} className="flex justify-between py-2">
                <span>
                  {i.qty} × {i.name}
                  {i.modifiers?.length > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      {i.modifiers.map((m) => m.name).join(" · ")}
                    </span>
                  )}
                </span>
                <span>{money(i.price_cents * i.qty)}</span>
              </li>
            ))}
          </ul>
          {!onTab && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Promo code</p>
              {promo ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/10 p-2 text-sm">
                  <div>
                    <span className="font-mono font-bold text-primary">{promo.code}</span>
                    <p className="text-xs text-muted-foreground">{promo.message}</p>
                  </div>
                  <button type="button" onClick={() => { setPromo(null); setPromoInput(""); }} className="text-xs font-semibold text-primary underline">Remove</button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder="Enter code" className="h-10 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm uppercase" />
                  <button type="button" onClick={applyPromo} disabled={promoBusy || !promoInput.trim()} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50">Apply</button>
                </div>
              )}
            </div>
          )}
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(subtotal)}</span></div>
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between text-primary"><span>Member discount (10%)</span><span>−{money(loyaltyDiscount)}</span></div>
            )}
            {promoDiscount > 0 && (
              <div className="flex justify-between text-primary"><span>Promo {promo?.code}</span><span>−{money(promoDiscount)}</span></div>
            )}
            {mode === "delivery" && (
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery{freeDeliveryByPromo || freeDeliveryByThreshold ? " (free)" : ""}</span><span>{money(delivery)}</span></div>
            )}
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-display text-lg font-bold"><span>Total</span><span className="text-primary">{money(total)}</span></div>
            {belowMin && (
              <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-center text-xs font-semibold text-destructive">
                Minimum order £{(minOrder/100).toFixed(2)} — add £{((minOrder-subtotal)/100).toFixed(2)} more.
              </p>
            )}
          </div>
          <button type="submit" form="checkout-form" disabled={busy || belowMin || storeBlocks} className="mt-4 h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover disabled:opacity-60">
            {busy ? "Placing…" : storeBlocks ? "Closed — try later" : belowMin ? `Add £${((minOrder-subtotal)/100).toFixed(2)} more` : onTab ? "Add to tab" : "Place order & pay"}
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {onTab ? "Billed to your account — settle later" : user ? "Secured by SumUp" : "Guest checkout · Secured by SumUp"}
          </p>
        </aside>
      </div>
    </div>
  );
}