import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { PromoBanner } from "@/components/promo-banner";
import { PromoCarousel } from "@/components/promo-carousel";
import { StoreStatus } from "@/components/store-status";
import { cart, useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { Plus, Minus, Search, Leaf, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — Cafe1" },
      { name: "description", content: "Browse the full Cafe1 menu: coffee, breakfast, sandwiches, sweet treats." },
      { property: "og:title", content: "Cafe1 Menu" },
      { property: "og:description", content: "Coffee, breakfast, sandwiches and treats — order for delivery or collection." },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => {
      const [cats, items, mods] = await Promise.all([
        supabase.from("menu_categories").select("*").eq("active", true).order("sort_order"),
        supabase.from("menu_items").select("*").eq("active", true).order("sort_order"),
        supabase.from("menu_modifiers").select("*").eq("active", true).order("sort_order"),
      ]);
      return { cats: cats.data ?? [], items: items.data ?? [], mods: mods.data ?? [] };
    },
  });

  const [q, setQ] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const cartState = useCart();
  const cartCount = cartState.items.reduce((a, i) => a + i.qty, 0);
  const cartTotal = cartState.items.reduce((a, i) => a + i.qty * i.price_cents, 0);

  const filtered = useMemo(() => {
    if (!data) return null;
    const ql = q.trim().toLowerCase();
    const items = data.items.filter((i) => {
      if (vegOnly && !i.is_veg) return false;
      if (!ql) return true;
      return (
        i.name.toLowerCase().includes(ql) ||
        (i.description ?? "").toLowerCase().includes(ql)
      );
    });
    const cats = data.cats.filter((c) => items.some((i) => i.category_id === c.id));
    return { cats, items, mods: data.mods };
  }, [data, q, vegOnly]);

  // Scrollspy: watch section headers to update active pill.
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const pillsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!filtered?.cats.length) return;
    setActiveCat((prev) => (prev && filtered.cats.some((c) => c.id === prev) ? prev : filtered.cats[0].id));
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveCat(visible.target.id.replace(/^cat-/, ""));
      },
      { rootMargin: "-160px 0px -60% 0px", threshold: 0 }
    );
    for (const c of filtered.cats) {
      const el = sectionRefs.current[c.id];
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [filtered?.cats.map((c) => c.id).join(",")]);

  // Auto-scroll pill row to active
  useEffect(() => {
    if (!activeCat || !pillsRef.current) return;
    const el = pillsRef.current.querySelector<HTMLButtonElement>(`[data-cat="${activeCat}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCat]);

  function scrollToCat(id: string) {
    const el = sectionRefs.current[id];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 140;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <SiteHeader />
      <PromoBanner />

      {/* Restaurant hero */}
      <div className="bg-gradient-to-b from-primary-soft/40 to-transparent">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-4 sm:pt-10">
          <PromoCarousel />
          <p className="text-xs font-medium uppercase tracking-widest text-primary">Cafe1 · St Albans</p>
          <h1 className="mt-1 font-display text-4xl font-bold sm:text-5xl">Menu</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Freshly made all day. Delivery, collection or dine-in.
          </p>
          <div className="mt-3"><StoreStatus /></div>
        </div>
      </div>

      {/* Sticky search + category pills */}
      <div className="sticky top-14 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center gap-2">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the menu"
                className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-10 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <button
              onClick={() => setVegOnly((v) => !v)}
              aria-pressed={vegOnly}
              className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition ${
                vegOnly
                  ? "border-green-600 bg-green-50 text-green-700"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              <Leaf className="h-4 w-4" /> Veg
            </button>
          </div>

          {/* Category pills */}
          {filtered && filtered.cats.length > 0 && (
            <div
              ref={pillsRef}
              className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {filtered.cats.map((c) => {
                const active = c.id === activeCat;
                return (
                  <button
                    key={c.id}
                    data-cat={c.id}
                    onClick={() => scrollToCat(c.id)}
                    className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-brand"
                        : "border-border bg-card text-foreground hover:border-primary/50"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">
        {isLoading && (
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
            ))}
          </div>
        )}

        {filtered && filtered.cats.length === 0 && !isLoading && (
          <div className="mt-16 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="font-display text-xl font-semibold">No matches</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing matches “{q}”{vegOnly ? " with veg filter on" : ""}.
            </p>
            <button
              onClick={() => { setQ(""); setVegOnly(false); }}
              className="mt-4 rounded-full border border-border px-4 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
            >
              Clear filters
            </button>
          </div>
        )}

        {filtered?.cats.map((cat) => {
          const items = filtered.items.filter((i) => i.category_id === cat.id);
          const catMods = filtered.mods.filter((m) => m.category_id === cat.id);
          if (!items.length) return null;
          const groups = new Map<string, typeof items>();
          for (const it of items) {
            const key = it.group_label ?? "";
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(it);
          }
          return (
            <section
              key={cat.id}
              id={`cat-${cat.id}`}
              ref={(el) => { sectionRefs.current[cat.id] = el; }}
              className="scroll-mt-40 pt-8"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-2xl font-bold sm:text-3xl">{cat.name}</h2>
                <span className="text-xs text-muted-foreground">{items.length} items</span>
              </div>
              {cat.description && <p className="mt-1 text-sm text-muted-foreground">{cat.description}</p>}

              {[...groups.entries()].map(([label, gItems]) => (
                <div key={label} className="mt-4">
                  {label && (
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {label}
                    </p>
                  )}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {gItems.map((i) => (
                      <ItemCard key={i.id} item={i} />
                    ))}
                  </div>
                </div>
              ))}

              {catMods.length > 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Add-ons
                  </p>
                  <p className="mt-1 text-sm text-foreground/80">
                    {catMods
                      .map((m) => `${m.name}${m.price_cents ? ` +${money(m.price_cents)}` : ""}`)
                      .join(" · ")}
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Floating basket bar */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex max-w-md justify-center px-4">
          <Link
            to="/cart"
            className="group flex w-full items-center justify-between gap-3 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-brand transition hover:bg-primary-hover"
          >
            <span className="inline-flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-foreground/15 text-sm font-bold">
                {cartCount}
              </span>
              <span className="font-semibold">View basket</span>
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              {money(cartTotal)}
              <ShoppingBag className="h-4 w-4 opacity-80" />
            </span>
          </Link>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  is_veg: boolean;
};

function ItemCard({ item }: { item: MenuItem }) {
  const cartState = useCart();
  const inCart = cartState.items.find((i) => i.id === item.id);
  const qty = inCart?.qty ?? 0;

  return (
    <div className="group relative flex gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-brand">
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {item.is_veg && (
            <span
              className="mt-1.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border border-green-600"
              title="Vegetarian"
              aria-label="Vegetarian"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
            </span>
          )}
          <p className="line-clamp-2 font-semibold">{item.name}</p>
        </div>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        )}
        <p className="mt-2 font-display text-lg font-bold text-primary">{money(item.price_cents)}</p>
      </div>

      <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className="h-full w-full rounded-xl object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center rounded-xl bg-muted text-muted-foreground">
            <ShoppingBag className="h-6 w-6 opacity-40" />
          </div>
        )}

        {qty === 0 ? (
          <button
            onClick={() => {
              cart.add({ id: item.id, name: item.name, price_cents: item.price_cents });
              toast.success(`Added ${item.name}`);
            }}
            className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-brand transition hover:bg-primary-hover"
            aria-label={`Add ${item.name}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : (
          <div className="absolute -bottom-2 -right-2 flex items-center gap-1 rounded-full border-2 border-background bg-primary px-1 py-0.5 text-primary-foreground shadow-brand">
            <button
              onClick={() => cart.setQty(item.id, qty - 1)}
              className="grid h-7 w-7 place-items-center rounded-full hover:bg-primary-hover"
              aria-label="Decrease"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[1ch] text-center text-sm font-bold">{qty}</span>
            <button
              onClick={() => cart.add({ id: item.id, name: item.name, price_cents: item.price_cents })}
              className="grid h-7 w-7 place-items-center rounded-full hover:bg-primary-hover"
              aria-label="Increase"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}