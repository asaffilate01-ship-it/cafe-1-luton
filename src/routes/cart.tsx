import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { cart, useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { Minus, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your basket — Cafe1" },
      { name: "description", content: "Review your Cafe1 order before checkout." },
      { property: "og:title", content: "Your basket — Cafe1" },
      { property: "og:description", content: "Review your Cafe1 order before checkout." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const c = useCart();
  const subtotal = c.items.reduce((s, i) => s + i.price_cents * i.qty, 0);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-4xl font-bold">Your basket</h1>
        {c.items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">Your basket is empty.</p>
            <Link to="/menu" className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover">Browse the menu</Link>
          </div>
        ) : (
          <>
            <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
              {c.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 p-4">
                  <div className="flex-1">
                    <p className="font-semibold">{i.name}</p>
                    {i.modifiers?.length > 0 && (
                      <p className="text-sm text-primary">
                        {i.modifiers
                          .map((m) => `${m.name}${m.price_cents ? ` +${money(m.price_cents)}` : ""}`)
                          .join(" · ")}
                      </p>
                    )}
                    {i.notes && <p className="text-sm italic text-muted-foreground">“{i.notes}”</p>}
                    <p className="text-sm text-muted-foreground">{money(i.price_cents)} each</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-border">
                    <button onClick={() => cart.setQty(i.id, i.qty - 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-primary-soft"><Minus className="h-4 w-4" /></button>
                    <span className="w-6 text-center text-sm font-semibold">{i.qty}</span>
                    <button onClick={() => cart.setQty(i.id, i.qty + 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-primary-soft"><Plus className="h-4 w-4" /></button>
                  </div>
                  <p className="w-20 text-right font-semibold">{money(i.price_cents * i.qty)}</p>
                  <button onClick={() => cart.remove(i.id)} className="text-muted-foreground hover:text-primary"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-card p-5">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-display text-2xl font-bold">{money(subtotal)}</span>
            </div>
            <Link to="/checkout" className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover">Checkout</Link>
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}