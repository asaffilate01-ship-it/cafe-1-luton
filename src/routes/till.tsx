import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { createCounterOrder } from "@/lib/pos.functions";
import {
  listPairedReaders,
  pairSumupReader,
  unpairSumupReader,
  startReaderPayment,
  checkReaderPayment,
  cancelReaderPayment,
} from "@/lib/till.functions";
import { openCashDrawer, getDrawerBridge, setDrawerBridge } from "@/lib/drawer";
import { money } from "@/lib/format";
import { toast } from "sonner";
import {
  Banknote, CreditCard, Minus, Plus, Search, Trash2, Lock, LogOut, Settings2, X,
  Smartphone, Loader2, Check, Printer, Inbox, ShoppingBag, HandPlatter, Bike,
  Delete, ReceiptText, UtensilsCrossed, ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/till")({
  head: () => ({
    meta: [
      { title: "Till — Cafe 1 St Albans" },
      { name: "description", content: "Counter till for Cafe 1 at St Albans Crown Court: ring up cash and card sales, take payment on the SumUp Solo and open the cash drawer." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Till — Cafe 1 St Albans" },
      { property: "og:description", content: "Staff-only counter till for Cafe 1 at St Albans Crown Court." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TillPage,
});

type Cat = { id: string; name: string; sort_order: number };
type Item = { id: string; name: string; price_cents: number; category_id: string | null; sort_order: number; image_url: string | null };
type Line = { id: string; name: string; price_cents: number; qty: number };
type Side = "jury" | "judge" | "public";
type Fulfilment = "dine_in" | "collection" | "delivery";

const SIDE_TONE: Record<Side, string> = {
  jury: "bg-indigo-600 text-white",
  judge: "bg-fuchsia-700 text-white",
  public: "bg-teal-600 text-white",
};
const SIDE_LABEL: Record<Side, string> = { jury: "Jury", judge: "Judge", public: "Public" };
const FULFIL: { id: Fulfilment; label: string; Icon: typeof ShoppingBag }[] = [
  { id: "dine_in", label: "Dine in", Icon: HandPlatter },
  { id: "collection", label: "Takeaway", Icon: ShoppingBag },
  { id: "delivery", label: "Delivery", Icon: Bike },
];

function TillPage() {
  const { user, loading } = useSession();
  const { has, loading: rolesLoading } = useRoles(user);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-950 text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!user) return <TillLogin />;
  if (!rolesLoading && !has("admin") && !has("staff")) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-950 px-6 text-center text-white">
        <div>
          <p className="font-display text-2xl font-bold">This login can&apos;t use the till</p>
          <p className="mt-2 text-sm text-white/60">Ask a manager for a staff account.</p>
          <button onClick={() => supabase.auth.signOut()} className="mt-5 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground">
            Sign out
          </button>
        </div>
      </div>
    );
  }
  return <Till />;
}

/* ---------------------------------------------------------------- login */

function TillLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-neutral-950 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900 p-7 text-white shadow-2xl">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1 text-xs font-black uppercase tracking-widest text-primary-foreground">
            Cafe 1 · Till
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold">Counter sign in</h1>
          <p className="mt-1 text-sm text-white/50">Staff till login — separate from the kitchen display and admin.</p>
        </div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/50">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="username"
          className="mb-4 h-12 w-full rounded-xl border border-white/10 bg-neutral-800 px-4 text-base outline-none focus:border-primary" />
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/50">Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoComplete="current-password"
          className="mb-6 h-12 w-full rounded-xl border border-white/10 bg-neutral-800 px-4 text-base outline-none focus:border-primary" />
        <button disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Open till
        </button>
      </form>
    </div>
  );
}

/* ----------------------------------------------------------------- till */

function Till() {
  const create = useServerFn(createCounterOrder);
  const readersFn = useServerFn(listPairedReaders);

  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [catId, setCatId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<Fulfilment>("dine_in");
  const [table, setTable] = useState("");
  const [side, setSide] = useState<Side>(() => {
    if (typeof window === "undefined") return "public";
    return (window.localStorage.getItem("cafe1-pos-side") as Side) || "public";
  });
  const [readers, setReaders] = useState<{ id: string; name: string; status: string }[]>([]);
  const [readerId, setReaderId] = useState<string>(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem("cafe1-till-reader") ?? "",
  );
  const [pay, setPay] = useState<null | "cash" | "reader" | "manual">(null);
  const [settings, setSettings] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ n: number; total: number; id: string } | null>(null);

  useEffect(() => { window.localStorage.setItem("cafe1-pos-side", side); }, [side]);
  useEffect(() => {
    if (readerId) window.localStorage.setItem("cafe1-till-reader", readerId);
  }, [readerId]);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: i }] = await Promise.all([
        supabase.from("menu_categories").select("id, name, sort_order").eq("active", true).order("sort_order"),
        supabase.from("menu_items").select("id, name, price_cents, category_id, sort_order").eq("active", true).order("sort_order"),
      ]);
      setCats((c ?? []) as Cat[]);
      setItems((i ?? []) as Item[]);
      setCatId((c ?? [])[0]?.id ?? null);
    })();
  }, []);

  const loadReaders = useCallback(async () => {
    try {
      const res = await readersFn({});
      if (res.ok) {
        setReaders(res.readers);
        setReaderId((prev) => prev || res.readers[0]?.id || "");
      }
    } catch {
      /* SumUp keys may not be configured yet */
    }
  }, [readersFn]);
  useEffect(() => { void loadReaders(); }, [loadReaders]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term) return items.filter((i) => i.name.toLowerCase().includes(term)).slice(0, 80);
    return items.filter((i) => i.category_id === catId);
  }, [items, catId, q]);

  const total = lines.reduce((s, l) => s + l.price_cents * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

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
    setLines((prev) => prev.flatMap((l) => (l.id === id ? (l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }]) : [l])));
  }

  const finish = useCallback(
    async (payment_method: "cash" | "card", sumup_transaction_id?: string) => {
      setBusy(true);
      try {
        const res = await create({
          data: {
            customer_name: name.trim() || "Counter",
            type,
            table_number: table.trim() || undefined,
            payment_method,
            sumup_transaction_id,
            pos_terminal: side,
            items: lines.map((l) => ({ menu_item_id: l.id, qty: l.qty })),
          },
        });
        setLastOrder({ n: res.order_number, total: res.total_cents, id: res.order_id });
        toast.success(`Order #${res.order_number} sent to the kitchen · ${money(res.total_cents)}`);
        window.open(`/print/${res.order_id}`, "_blank");
        if (payment_method === "cash") void openCashDrawer();
        setLines([]); setName(""); setTable(""); setPay(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not take that order");
      } finally {
        setBusy(false);
      }
    },
    [create, lines, name, side, table, type],
  );

  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 text-white">
      {/* top bar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-neutral-900 px-4 py-2.5">
        <span className="rounded-lg bg-primary px-3 py-1 text-xs font-black uppercase tracking-widest text-primary-foreground">Cafe 1 Till</span>
        <div className="flex gap-1.5">
          {(["jury", "judge", "public"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wide transition ${side === s ? SIDE_TONE[s] : "border border-white/15 text-white/60 hover:border-white/40"}`}>
              {SIDE_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-white/50">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${readerId ? "border-emerald-500/40 text-emerald-300" : "border-white/15"}`}>
            <Smartphone className="h-3.5 w-3.5" />
            {readerId ? readers.find((r) => r.id === readerId)?.name ?? "Solo reader" : "No reader"}
          </span>
          <button onClick={() => void openCashDrawer().then((r) => (r.ok ? toast.success(r.message) : toast.error(r.message)))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 font-semibold text-white/80 hover:border-white/40">
            <Inbox className="h-4 w-4" /> Drawer
          </button>
          <button onClick={() => setSettings(true)} aria-label="Till settings" className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 hover:border-white/40"><Settings2 className="h-4 w-4" /></button>
          <button onClick={() => setLocked(true)} aria-label="Lock till" className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 hover:border-white/40"><Lock className="h-4 w-4" /></button>
          <button onClick={() => supabase.auth.signOut()} aria-label="Sign out of the till" className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 hover:border-white/40"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_400px]">
        {/* products */}
        <section className="flex min-h-0 flex-col">
          <div className="shrink-0 space-y-3 border-b border-white/10 p-4">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-neutral-900 px-4">
              <Search className="h-4 w-4 text-white/40" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the whole menu…"
                className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30" />
              {q && <button onClick={() => setQ("")} aria-label="Clear search"><X className="h-4 w-4 text-white/40" /></button>}
            </div>
            {!q && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {cats.map((c) => (
                  <button key={c.id} onClick={() => setCatId(c.id)}
                    className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition ${catId === c.id ? "bg-white text-neutral-950" : "border border-white/10 bg-neutral-900 text-white/70 hover:border-white/40"}`}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {visible.map((i) => (
                <button key={i.id} onClick={() => add(i)}
                  className="flex h-24 flex-col justify-between rounded-2xl border border-white/10 bg-neutral-900 p-3 text-left transition hover:border-primary hover:bg-neutral-800 active:scale-[0.98]">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug">{i.name}</span>
                  <span className="font-display text-lg font-bold text-primary">{money(i.price_cents)}</span>
                </button>
              ))}
              {!visible.length && <p className="text-sm text-white/40">No items.</p>}
            </div>
          </div>
        </section>

        {/* order panel */}
        <aside className="flex min-h-0 flex-col border-l border-white/10 bg-neutral-900">
          <div className="shrink-0 space-y-2 border-b border-white/10 p-4">
            <div className="grid grid-cols-3 gap-1.5">
              {FULFIL.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setType(id)}
                  className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-bold uppercase tracking-wide transition ${type === id ? "bg-primary text-primary-foreground" : "border border-white/10 text-white/60 hover:border-white/40"}`}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name (optional)"
                className="h-10 rounded-xl border border-white/10 bg-neutral-800 px-3 text-sm outline-none placeholder:text-white/30 focus:border-primary" />
              {type === "dine_in" ? (
                <input value={table} onChange={(e) => setTable(e.target.value)} placeholder="Table number"
                  className="h-10 rounded-xl border border-white/10 bg-neutral-800 px-3 text-sm outline-none placeholder:text-white/30 focus:border-primary" />
              ) : <div className="hidden sm:block" />}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center gap-2 rounded-xl bg-neutral-800/60 p-2 text-sm">
                  <div className="flex items-center gap-1">
                    <button onClick={() => bump(l.id, -1)} aria-label={`Remove one ${l.name}`} className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 hover:border-primary"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-6 text-center font-bold">{l.qty}</span>
                    <button onClick={() => bump(l.id, 1)} aria-label={`Add one ${l.name}`} className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 hover:border-primary"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  <span className="flex-1 truncate">{l.name}</span>
                  <span className="font-semibold">{money(l.price_cents * l.qty)}</span>
                </li>
              ))}
              {!lines.length && (
                <li className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">
                  Tap items to start an order
                  {lastOrder && (
                    <span className="mt-3 block text-xs text-white/50">
                      Last: #{lastOrder.n} · {money(lastOrder.total)}
                      <button onClick={() => window.open(`/print/${lastOrder.id}`, "_blank")} className="ml-2 inline-flex items-center gap-1 underline">
                        <Printer className="h-3 w-3" /> reprint
                      </button>
                    </span>
                  )}
                </li>
              )}
            </ul>
          </div>

          <div className="shrink-0 space-y-3 border-t border-white/10 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-white/50">{count} item{count === 1 ? "" : "s"}</span>
              <span className="font-display text-3xl font-black text-primary">{money(total)}</span>
            </div>
            <div className="grid gap-2">
              <button disabled={!lines.length || busy} onClick={() => setPay("reader")}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-40">
                <Smartphone className="h-5 w-5" /> Charge SumUp Solo
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={!lines.length || busy} onClick={() => setPay("cash")}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-40">
                  <Banknote className="h-4 w-4" /> Cash
                </button>
                <button disabled={!lines.length || busy} onClick={() => setPay("manual")}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-bold text-white/80 disabled:opacity-40">
                  <CreditCard className="h-4 w-4" /> Other card
                </button>
              </div>
              <button disabled={!lines.length} onClick={() => setLines([])}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white/40 hover:text-white disabled:opacity-40">
                <Trash2 className="h-3.5 w-3.5" /> Clear order
              </button>
            </div>
          </div>
        </aside>
      </div>

      {pay === "cash" && <CashPay total={total} busy={busy} onClose={() => setPay(null)} onDone={() => finish("cash")} />}
      {pay === "manual" && (
        <Modal title="Paid on another card machine" onClose={() => setPay(null)}>
          <p className="text-sm text-white/60">Confirm once the customer&apos;s card payment has gone through on the terminal.</p>
          <button disabled={busy} onClick={() => finish("card")} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">
            <Check className="h-4 w-4" /> Mark paid · {money(total)}
          </button>
        </Modal>
      )}
      {pay === "reader" && (
        <ReaderPay
          total={total}
          readers={readers}
          readerId={readerId}
          setReaderId={setReaderId}
          onClose={() => setPay(null)}
          onPaid={(txn) => finish("card", txn ?? undefined)}
          onSettings={() => { setPay(null); setSettings(true); }}
        />
      )}
      {settings && <TillSettings readers={readers} reload={loadReaders} onClose={() => setSettings(false)} />}
    </div>
  );
}

/* -------------------------------------------------------------- widgets */

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900 p-6 text-white shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 hover:border-white/40"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CashPay({ total, busy, onClose, onDone }: { total: number; busy: boolean; onClose: () => void; onDone: () => void }) {
  const [tendered, setTendered] = useState<number>(0);
  const change = tendered - total;
  const quick = [total, 500, 1000, 2000, 5000].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <Modal title="Cash payment" onClose={onClose}>
      <div className="rounded-2xl bg-neutral-800 p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40">Total due</p>
        <p className="font-display text-4xl font-black text-primary">{money(total)}</p>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {quick.map((v, i) => (
          <button key={`${v}-${i}`} onClick={() => setTendered(v)}
            className={`rounded-xl py-2.5 text-sm font-bold ${tendered === v ? "bg-emerald-600 text-white" : "border border-white/10 text-white/80 hover:border-white/40"}`}>
            {i === 0 ? "Exact" : money(v)}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
          <button key={n} onClick={() => setTendered((t) => Math.min(t * 10 + n * 100, 5000000))}
            className="rounded-xl border border-white/10 py-3 text-lg font-bold hover:border-white/40">{n}</button>
        ))}
        <button onClick={() => setTendered(0)} className="rounded-xl border border-white/10 py-3 text-sm font-bold text-white/60 hover:border-white/40">Clear</button>
        <button onClick={() => void openCashDrawer()} className="rounded-xl border border-white/10 py-3 text-xs font-bold text-white/60 hover:border-white/40">Drawer</button>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-neutral-800 px-4 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Tendered</p>
          <p className="text-lg font-bold">{money(tendered)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Change</p>
          <p className={`text-lg font-bold ${change < 0 ? "text-white/30" : "text-emerald-400"}`}>{change < 0 ? "—" : money(change)}</p>
        </div>
      </div>
      <button disabled={busy} onClick={onDone}
        className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-bold text-white disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-5 w-5" />} Take cash & open drawer
      </button>
    </Modal>
  );
}

function ReaderPay({
  total, readers, readerId, setReaderId, onClose, onPaid, onSettings,
}: {
  total: number;
  readers: { id: string; name: string; status: string }[];
  readerId: string;
  setReaderId: (v: string) => void;
  onClose: () => void;
  onPaid: (txn: string | null) => void;
  onSettings: () => void;
}) {
  const start = useServerFn(startReaderPayment);
  const check = useServerFn(checkReaderPayment);
  const cancel = useServerFn(cancelReaderPayment);
  const [state, setState] = useState<"idle" | "waiting" | "failed">("idle");
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function begin() {
    if (!readerId) return toast.error("Pick a card reader first");
    setState("waiting"); setNote("Tap, insert or swipe on the Solo…");
    try {
      const { client_transaction_id } = await start({ data: { reader_id: readerId, amount_cents: total } });
      const started = Date.now();
      timer.current = setInterval(async () => {
        try {
          const r = await check({ data: { client_transaction_id } });
          if (r.paid) {
            if (timer.current) clearInterval(timer.current);
            onPaid(r.transaction_id);
          } else if (r.failed) {
            if (timer.current) clearInterval(timer.current);
            setState("failed"); setNote("Payment declined or cancelled on the reader");
          } else if (Date.now() - started > 3 * 60_000) {
            if (timer.current) clearInterval(timer.current);
            setState("failed"); setNote("Timed out waiting for the reader");
          }
        } catch { /* keep polling */ }
      }, 2500);
    } catch (e) {
      setState("failed");
      setNote(e instanceof Error ? e.message : "Could not reach the reader");
    }
  }

  async function abort() {
    if (timer.current) clearInterval(timer.current);
    if (readerId) { try { await cancel({ data: { reader_id: readerId } }); } catch { /* ignore */ } }
    onClose();
  }

  return (
    <Modal title="Card payment on SumUp Solo" onClose={abort}>
      <div className="rounded-2xl bg-neutral-800 p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40">Amount</p>
        <p className="font-display text-4xl font-black text-primary">{money(total)}</p>
      </div>

      {readers.length > 0 ? (
        <div className="mt-4 space-y-1.5">
          {readers.map((r) => (
            <button key={r.id} onClick={() => setReaderId(r.id)} disabled={state === "waiting"}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${readerId === r.id ? "bg-primary text-primary-foreground" : "border border-white/10 text-white/80 hover:border-white/40"}`}>
              <Smartphone className="h-4 w-4" /> {r.name}
              <span className="ml-auto text-[11px] uppercase opacity-70">{r.status}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-white/10 p-3 text-sm text-white/60">
          No SumUp reader paired yet.{" "}
          <button onClick={onSettings} className="underline">Pair your Solo</button> in till settings.
        </p>
      )}

      {state === "waiting" ? (
        <div className="mt-5 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-2 text-sm font-semibold">{note}</p>
          <button onClick={abort} className="mt-3 text-xs font-semibold text-white/60 underline">Cancel payment</button>
        </div>
      ) : (
        <>
          {state === "failed" && <p className="mt-4 rounded-xl bg-red-500/15 p-3 text-sm text-red-300">{note}</p>}
          <button disabled={!readers.length} onClick={begin}
            className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-40">
            <CreditCard className="h-5 w-5" /> Send to reader
          </button>
        </>
      )}
    </Modal>
  );
}

function TillSettings({ readers, reload, onClose }: { readers: { id: string; name: string; status: string }[]; reload: () => Promise<void>; onClose: () => void }) {
  const pairFn = useServerFn(pairSumupReader);
  const unpairFn = useServerFn(unpairSumupReader);
  const [code, setCode] = useState("");
  const [name, setName] = useState("Counter Solo");
  const [bridge, setBridge] = useState(getDrawerBridge());
  const [busy, setBusy] = useState(false);

  async function pair() {
    if (!code.trim()) return toast.error("Enter the pairing code shown on the Solo");
    setBusy(true);
    try {
      await pairFn({ data: { pairing_code: code.trim(), name: name.trim() || "Solo" } });
      toast.success("Reader paired");
      setCode("");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pairing failed");
    } finally { setBusy(false); }
  }

  async function unpair(id: string) {
    try { await unpairFn({ data: { reader_id: id } }); toast.success("Reader removed"); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not remove reader"); }
  }

  return (
    <Modal title="Till settings" onClose={onClose}>
      <p className="text-xs font-bold uppercase tracking-widest text-white/40">SumUp Solo readers</p>
      <div className="mt-2 space-y-1.5">
        {readers.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm">
            <Smartphone className="h-4 w-4 text-white/50" />
            <span className="flex-1 truncate font-semibold">{r.name}</span>
            <span className="text-[11px] uppercase text-white/40">{r.status}</span>
            <button onClick={() => unpair(r.id)} aria-label={`Remove ${r.name}`} className="grid h-7 w-7 place-items-center rounded-lg border border-white/15 hover:border-primary"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {!readers.length && <p className="text-sm text-white/50">None paired yet.</p>}
      </div>
      <p className="mt-3 text-xs text-white/40">
        On the Solo: Settings → Connections → Pair device, then type the code below.
      </p>
      <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reader name"
          className="h-10 rounded-xl border border-white/10 bg-neutral-800 px-3 text-sm outline-none focus:border-primary" />
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Pairing code"
          className="h-10 rounded-xl border border-white/10 bg-neutral-800 px-3 font-mono text-sm outline-none focus:border-primary" />
        <button disabled={busy} onClick={pair} className="inline-flex h-10 items-center gap-1 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Pair
        </button>
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-widest text-white/40">Cash drawer</p>
      <p className="mt-1 text-xs text-white/40">
        On the iMin/Sunmi terminal the drawer opens through the built-in printer automatically. On other
        devices, point the till at a local ESC/POS printer bridge.
      </p>
      <div className="mt-2 flex gap-2">
        <input value={bridge} onChange={(e) => setBridge(e.target.value)} placeholder="http://192.168.1.50:8080/kick"
          className="h-10 flex-1 rounded-xl border border-white/10 bg-neutral-800 px-3 text-sm outline-none focus:border-primary" />
        <button onClick={() => { setDrawerBridge(bridge); toast.success("Saved on this device"); }}
          className="h-10 rounded-xl border border-white/15 px-4 text-sm font-bold hover:border-primary">Save</button>
      </div>
      <button onClick={() => void openCashDrawer().then((r) => (r.ok ? toast.success(r.message) : toast.error(r.message)))}
        className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-bold hover:border-primary">
        <Inbox className="h-4 w-4" /> Test drawer
      </button>
    </Modal>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-neutral-950 text-white">
      <button onClick={onUnlock} className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-neutral-900 px-16 py-14">
        <Lock className="h-10 w-10 text-primary" />
        <span className="font-display text-2xl font-bold">Till locked</span>
        <span className="text-sm text-white/50">Tap to carry on serving</span>
      </button>
    </div>
  );
}
