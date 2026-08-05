import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { cart, useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { Search, Plus, Leaf, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

type Item = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  is_veg: boolean;
  juror_menu: boolean;
};

/**
 * Shared item list used by the gated Jury and Judges menus. The gate itself
 * lives in the route — this only renders what the gate has allowed through.
 */
export function GatedMenuList({
  filter,
  emptyMessage,
}: {
  filter: (item: Item) => boolean;
  emptyMessage: string;
}) {
  const [q, setQ] = useState("");
  const cartState = useCart();
  const count = cartState.items.reduce((a, i) => a + i.qty, 0);
  const total = cartState.items.reduce((a, i) => a + i.qty * i.price_cents, 0);

  const { data, isLoading } = useQuery({
    queryKey: ["gated-menu"],
    queryFn: async () => {
      const [cats, items] = await Promise.all([
        supabase.from("menu_categories").select("*").eq("active", true).order("sort_order"),
        supabase
          .from("menu_items")
          .select(
            "id, category_id, name, description, price_cents, image_url, is_veg, juror_menu, active, sort_order",
          )
          .eq("active", true)
          .order("sort_order"),
      ]);
      return { cats: cats.data ?? [], items: (items.data ?? []) as Item[] };
    },
  });

  const sections = useMemo(() => {
    if (!data) return [];
    const ql = q.trim().toLowerCase();
    const items = data.items.filter(
      (i) =>
        filter(i) &&
        (!ql ||
          i.name.toLowerCase().includes(ql) ||
          (i.description ?? "").toLowerCase().includes(ql)),
    );
    return data.cats
      .map((c) => ({ cat: c, items: items.filter((i) => i.category_id === c.id) }))
      .filter((s) => s.items.length > 0)
      .concat(
        items.some((i) => !i.category_id || !data.cats.some((c) => c.id === i.category_id))
          ? [
              {
                cat: { id: "other", name: "Other items" } as (typeof data.cats)[number],
                items: items.filter(
                  (i) => !i.category_id || !data.cats.some((c) => c.id === i.category_id),
                ),
              },
            ]
          : [],
      );
  }, [data, q, filter]);

  return (
    <div className="pb-28">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="relative mx-auto max-w-3xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search this menu"
            className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-sm"
          />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4">
        {isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading menu…</p>
        ) : sections.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          sections.map((section) => (
            <section key={section.cat.id} className="py-6">
              <h2 className="font-display text-2xl font-black">{section.cat.name}</h2>
              <ul className="mt-4 space-y-3">
                {section.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                        className="h-16 w-16 shrink-0 rounded-xl object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 font-semibold">
                        {item.name}
                        {item.is_veg ? <Leaf className="h-3.5 w-3.5 text-green-600" /> : null}
                      </p>
                      {item.description ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm font-bold">{money(item.price_cents)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        cart.add({
                          menu_item_id: item.id,
                          name: item.name,
                          base_price_cents: item.price_cents,
                        });
                        toast.success(`${item.name} added`);
                      }}
                      aria-label={`Add ${item.name}`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-4 backdrop-blur">
          <Link
            to="/cart"
            className="mx-auto flex h-12 max-w-3xl items-center justify-between rounded-full bg-primary px-5 font-bold text-primary-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" /> {count} item{count === 1 ? "" : "s"}
            </span>
            <span>{money(total)}</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}