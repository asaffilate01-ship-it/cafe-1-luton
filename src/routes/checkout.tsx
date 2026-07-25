import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createOrder } from "@/lib/orders.functions";
import { cart, useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { SiteHeader } from "@/components/site-header";
import { useSession } from "@/hooks/use-auth";
import { toast } from "sonner";

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

function Checkout() {
  const c = useCart();
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const place = useServerFn(createOrder);
  const [mode, setMode] = useState<Mode>("collection");
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    address_line1: "",
    city: "",
    postcode: "",
    delivery_notes: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { next: "/checkout" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user?.email && !form.customer_email)
      setForm((f) => ({ ...f, customer_email: user.email ?? "" }));
  }, [user, form.customer_email]);

  const subtotal = c.items.reduce((s, i) => s + i.price_cents * i.qty, 0);
  const delivery = mode === "delivery" ? 299 : 0;
  const total = subtotal + delivery;

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
          address_line1: mode === "delivery" ? form.address_line1 : undefined,
          city: mode === "delivery" ? form.city : undefined,
          postcode: mode === "delivery" ? form.postcode : undefined,
          delivery_notes: form.delivery_notes || undefined,
          items: c.items.map((i) => ({ menu_item_id: i.id, qty: i.qty })),
        },
      });
      cart.clear();
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        if (!res.payment_configured)
          toast.message("Order placed. Pay at the counter — SumUp online checkout isn't configured yet.");
        navigate({ to: "/order/$orderId", params: { orderId: res.order_id } });
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
        <form onSubmit={submit} className="space-y-6">
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
                  {m.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-semibold">Your details</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input required placeholder="Full name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
              <input required placeholder="Phone" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
              <input type="email" placeholder="Email (optional)" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4 sm:col-span-2" />
            </div>
          </div>

          {mode === "delivery" && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="font-semibold">Delivery address</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input required placeholder="Address" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4 sm:col-span-2" />
                <input required placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
                <input required placeholder="Postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
                <textarea placeholder="Delivery notes (optional)" value={form.delivery_notes} onChange={(e) => setForm({ ...form, delivery_notes: e.target.value })} className="min-h-20 rounded-xl border border-border bg-background p-3 sm:col-span-2" />
              </div>
            </div>
          )}
        </form>

        <aside className="h-fit rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold">Order summary</p>
          <ul className="mt-3 divide-y divide-border text-sm">
            {c.items.map((i) => (
              <li key={i.id} className="flex justify-between py-2">
                <span>{i.qty} × {i.name}</span>
                <span>{money(i.price_cents * i.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{money(delivery)}</span></div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-display text-lg font-bold"><span>Total</span><span className="text-primary">{money(total)}</span></div>
          </div>
          <button onClick={submit} disabled={busy} className="mt-4 h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover disabled:opacity-60">
            {busy ? "Placing…" : "Place order & pay"}
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">Secured by SumUp</p>
        </aside>
      </div>
    </div>
  );
}