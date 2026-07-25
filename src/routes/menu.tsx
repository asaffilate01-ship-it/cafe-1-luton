import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { cart } from "@/lib/cart";
import { money } from "@/lib/format";
import { Plus } from "lucide-react";
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
      const [cats, items] = await Promise.all([
        supabase.from("menu_categories").select("*").eq("active", true).order("sort_order"),
        supabase.from("menu_items").select("*").eq("active", true).order("sort_order"),
      ]);
      return { cats: cats.data ?? [], items: items.data ?? [] };
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="font-display text-5xl font-bold">Menu</h1>
        <p className="mt-2 text-muted-foreground">Tap the plus to add an item to your basket.</p>

        {isLoading && <p className="mt-8 text-muted-foreground">Loading menu…</p>}

        {data?.cats.map((cat) => {
          const items = data.items.filter((i) => i.category_id === cat.id);
          if (!items.length) return null;
          return (
            <section key={cat.id} className="mt-12">
              <h2 className="font-display text-2xl font-bold">{cat.name}</h2>
              {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((i) => (
                  <div key={i.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50 hover:shadow-brand">
                    <div>
                      <p className="font-semibold">{i.name}</p>
                      {i.description && <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>}
                      <p className="mt-2 font-display text-lg font-bold text-primary">{money(i.price_cents)}</p>
                    </div>
                    <button
                      onClick={() => {
                        cart.add({ id: i.id, name: i.name, price_cents: i.price_cents });
                        toast.success(`Added ${i.name}`);
                      }}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary-hover"
                      aria-label={`Add ${i.name}`}
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <SiteFooter />
    </div>
  );
}