import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminNav } from "@/components/admin-nav";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { createCounterOrder } from "@/lib/pos.functions";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Banknote, CreditCard, Minus, Plus, Search, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/pos")({
  head: () => ({
    meta: [
      { title: "Counter till — Cafe1" },
      { name: "description", content: "Ring up cash and card-machine orders at the Cafe1 counter." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Till,
});

type Cat = { id: string; name: string; sort_order: number };
type Item = { id: string; name: string; price_cents: number; category_id: string | null; active: boolean; sort_order: number };
type Line = { id: string; name: string; price_cents: number; qty: number };

function Till() {
  const { user, loading } = useSession();
  const { has, loading: rolesLoading } = useRoles(user);
  const navigate = useNavigate();
  const create = useServerFn(createCounterOrder);

  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [catId, setCatId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"dine_in" | "collection" | "delivery">("dine_in");
  const [table, setTable] = useState("");
  const [side, setSide] = useState<"jury" | "public">(() => {
    if (typeof window === "undefined") return "public";
    return (window.localStorage.getItem("cafe1-pos-side") as "jury" | "public") || "public";
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("cafe1-pos-side", side);
  }, [side]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/admin/login", search: { next: "/admin/pos" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: i }] = await Promise.all([
        supabase.from("menu_categories").select("id, name, sort_order").eq("active", true).order("sort_order"),
        supabase.from("menu_items").select("id, name, price_cents, category_id, active, sort_order").eq("active", true).order("sort_order"),
      ]);
      setCats((c ?? []) as Cat[]);
      setItems((i ?? []) as Item[]);
      setCatId((c ?? [])[0]?.id ?? null);
    })();
  }, []);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term) return items.filter((i) => i.name.toLowerCase().includes(term)).slice(0, 60);
    return items.filter((i) => i.category_id === catId);
  }, [items, catId, q]);

  const total = lines.reduce((s, l) => s + l.price_cents * l.qty, 0);

  function add(i: Item) {
    setLines((prev) => {
      const at = prev.findIndex((l) => l.id === i.id);
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at], qty: next[at].qty + 1 };
        return next;
      }
      return [...prev, { id: i.id, name: i.name, price_cents: i.price_cents, qty: 1 }];
    });
  }
  function bump(id: string, d: number) {
    setLines((prev) =>
      prev.flatMap((l) => (l.id === id ? (l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }]) : [l])),
    );
  }

  async function take(payment_method: "cash" | "card") {
    if (!lines.length) return toast.error("Add some items first");
    setBusy(true);
    try {
      const res = await create({
        data: {
          customer_name: name.trim() || "Counter",
          type,
          table_number: table.trim() || undefined,
          payment_method,
          pos_terminal: side,
          items: lines.map((l) => ({ menu_item_id: l.id, qty: l.qty })),
        },
      });
      toast.success(`Order #${res.order_number} sent to the kitchen · ${money(res.total_cents)}`);
      window.open(`/print/${res.order_id}`, "_blank");
      setLines([]); setName(""); setTable("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not take that order");
    } finally {
      setBusy(false);
    }
  }

  if (!rolesLoading && user && !has("admin") && !has("staff")) {
    return <div className="p-10 text-center text-muted-foreground">Not authorised.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <div>
          <h1 className="font-display text-3xl font-bold">Counter till</h1>
          <p className="text-sm text-muted-foreground">Ring up walk-in orders paid by cash or the card machine. They land on the kitchen display as paid.</p>

          <div className="mt-4 flex items-center gap-2 rounded-full border border-border bg-card px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the whole menu…"
              className="h-11 flex-1 bg-transparent text-sm outline-none"
            />
          </div>

          {!q && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCatId(c.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${catId === c.id ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:border-primary"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((i) => (
              <button
                key={i.id}
                onClick={() => add(i)}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-left text-sm hover:border-primary"
              >
                <span className="font-medium">{i.name}</span>
                <span className="shrink-0 font-semibold text-primary">{money(i.price_cents)}</span>
              </button>
            ))}
            {!visible.length && <p className="text-sm text-muted-foreground">No items.</p>}
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-20">
          <h2 className="font-display text-xl font-bold">Current order</h2>

          <div className="mt-3 space-y-2">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">This till / POS side</p>
              <div className="flex gap-2">
                {(["jury", "judge", "public"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={`flex-1 rounded-xl px-2 py-2 text-xs font-black uppercase tracking-wide ${
                      side === s
                        ? s === "jury"
                          ? "bg-indigo-600 text-white"
                          : s === "judge"
                            ? "bg-fuchsia-700 text-white"
                            : "bg-teal-600 text-white"
                        : "border border-border hover:border-primary"
                    }`}
                  >
                    {s === "public" ? "Public side" : s}
                  </button>
                ))}
              </div>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name (optional)"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            <div className="flex gap-2">
              {(["dine_in", "collection", "delivery"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-xl px-2 py-2 text-xs font-semibold capitalize ${type === t ? "bg-primary text-primary-foreground" : "border border-border hover:border-primary"}`}
                >
                  {t === "collection" ? "Pickup" : t.replace("_", " ")}
                </button>
              ))}
            </div>
            {type === "dine_in" && (
              <input
                value={table}
                onChange={(e) => setTable(e.target.value)}
                placeholder="Table number"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            )}
          </div>

          <ul className="mt-4 space-y-2">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <button onClick={() => bump(l.id, -1)} className="grid h-7 w-7 place-items-center rounded-full border border-border hover:border-primary"><Minus className="h-3 w-3" /></button>
                  <span className="w-6 text-center font-semibold">{l.qty}</span>
                  <button onClick={() => bump(l.id, 1)} className="grid h-7 w-7 place-items-center rounded-full border border-border hover:border-primary"><Plus className="h-3 w-3" /></button>
                </div>
                <span className="flex-1 truncate">{l.name}</span>
                <span className="font-semibold">{money(l.price_cents * l.qty)}</span>
              </li>
            ))}
            {!lines.length && <li className="text-sm text-muted-foreground">Tap items to add them.</li>}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-display text-2xl font-bold text-primary">{money(total)}</span>
          </div>

          <div className="mt-4 grid gap-2">
            <button
              disabled={busy || !lines.length}
              onClick={() => take("cash")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-600 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Banknote className="h-4 w-4" /> Paid cash
            </button>
            <button
              disabled={busy || !lines.length}
              onClick={() => take("card")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" /> Paid by card machine
            </button>
            <button
              disabled={!lines.length}
              onClick={() => setLines([])}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border text-sm font-semibold text-muted-foreground hover:border-primary disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Clear
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
