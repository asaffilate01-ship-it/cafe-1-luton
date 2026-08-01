import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import {
  createCounterOrder,
  prepareCounterOrder,
  finalizeCounterCardPayment,
  cancelCounterOrder,
} from "@/lib/pos.functions";
import {
  listPairedReaders,
  pairSumupReader,
  unpairSumupReader,
  startReaderPayment,
  checkReaderPayment,
  cancelReaderPayment,
  getTillShift,
  openTillShift,
  closeTillShift,
} from "@/lib/till.functions";
import { openCashDrawer, getDrawerBridge, setDrawerBridge } from "@/lib/drawer";
import { iminPrintTickets, isIminDevice, openCustomerScreen } from "@/lib/imin";
import { postToDisplay } from "@/lib/customer-display";
import { lookupVoucher } from "@/lib/vouchers.functions";
import { QrCode } from "@/components/qr-code";
import { jurorFoodDiscount, JUROR_DAILY_ALLOWANCE_CENTS, JUROR_FOOD_DISCOUNT_PERCENT } from "@/lib/juror";
import { money } from "@/lib/format";
import { toast } from "sonner";
import {
  Banknote, CreditCard, Minus, Plus, Search, Trash2, Lock, LogOut, Settings2, X,
  Smartphone, Loader2, Check, Printer, Inbox, ShoppingBag, HandPlatter, MonitorPlay,
  Delete, ReceiptText, UtensilsCrossed, ChevronDown, Ticket, ShieldCheck, Wifi, WifiOff,
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
type Item = { id: string; name: string; price_cents: number; category_id: string | null; sort_order: number; image_url: string | null; is_beverage: boolean };
type Modifier = {
  id: string; item_id: string | null; category_id: string | null; name: string;
  price_cents: number; group_name: string | null; group_type: string; required: boolean; sort_order: number;
};

type Line = {
  key: string; id: string; name: string; price_cents: number; qty: number;
  is_beverage: boolean; modifier_ids: string[]; notes: string; detail: string;
};
type Side = "jury" | "judge" | "public";
type Fulfilment = "dine_in" | "collection";

const RECENT_KEY = "cafe1-till-recent";

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}
type Shift = {
  id: string;
  terminal: string;
  opening_float_cents: number;
  discrepancy_cents?: number | null;
};

const SIDE_TONE: Record<Side, string> = {
  jury: "bg-indigo-600 text-white",
  judge: "bg-fuchsia-700 text-white",
  public: "bg-teal-600 text-white",
};
const SIDE_LABEL: Record<Side, string> = { jury: "Jury", judge: "Judge", public: "Public" };
const FULFIL: { id: Fulfilment; label: string; Icon: typeof ShoppingBag }[] = [
  { id: "dine_in", label: "Dine in", Icon: HandPlatter },
  { id: "collection", label: "Takeaway", Icon: ShoppingBag },
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
  const prepare = useServerFn(prepareCounterOrder);
  const finalizeCard = useServerFn(finalizeCounterCardPayment);
  const cancelOrder = useServerFn(cancelCounterOrder);
  const shiftFn = useServerFn(getTillShift);
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
  const [readerError, setReaderError] = useState<string | null>(null);
  const [readerId, setReaderId] = useState<string>(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem("cafe1-till-reader") ?? "",
  );
  const [pay, setPay] = useState<null | "cash" | "reader" | "manual">(null);
  const [settings, setSettings] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ n: number; total: number; id: string } | null>(null);
  const [tendered, setTendered] = useState(0);
  const [showOrder, setShowOrder] = useState(false);
  const [voucher, setVoucher] = useState<null | { code: string; remaining_cents: number; allocated_cents: number; opted_in: boolean }>(null);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [shift, setShift] = useState<Shift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [prepared, setPrepared] = useState<null | { order_id: string; order_number: number; total_cents: number; voucher_cents: number; juror_discount_cents: number }>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  const loadShift = useCallback(async () => {
    setShiftLoading(true);
    try {
      const s = (await shiftFn({ data: { terminal: side } })) as Shift | null;
      setShift(s ?? null);
    } catch (e) {
      setShift(null);
      toast.error(e instanceof Error ? e.message : "Could not load the till shift");
    } finally {
      setShiftLoading(false);
    }
  }, [shiftFn, side]);
  useEffect(() => { void loadShift(); }, [loadShift]);

  useEffect(() => { window.localStorage.setItem("cafe1-pos-side", side); }, [side]);
  useEffect(() => {
    if (readerId) window.localStorage.setItem("cafe1-till-reader", readerId);
  }, [readerId]);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: i }] = await Promise.all([
        supabase.from("menu_categories").select("id, name, sort_order").eq("active", true).order("sort_order"),
        supabase.from("menu_items").select("id, name, price_cents, category_id, sort_order, image_url, is_beverage").eq("active", true).order("sort_order"),
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
        setReaderError(null);
        setReaderId((prev) => prev || res.readers[0]?.id || "");
      } else {
        setReaders([]);
        setReaderError(res.error ?? "Could not reach SumUp");
      }
    } catch (e) {
      setReaderError(e instanceof Error ? e.message : "Could not reach SumUp");
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
  const foodTotal = lines.reduce((s, l) => s + (l.is_beverage ? 0 : l.price_cents * l.qty), 0);
  const voucherApplied = voucher ? Math.min(voucher.remaining_cents, total) : 0;
  const jurorDiscount = voucher ? jurorFoodDiscount(Math.max(0, total - voucherApplied), foodTotal) : 0;
  const due = Math.max(0, total - voucherApplied - jurorDiscount);

  // mirror the basket onto the customer-facing second screen (/display)
  useEffect(() => {
    postToDisplay(
      lines.length
        ? { type: "order" as const, lines: lines.map((l) => ({ id: l.id, name: l.name, price_cents: l.price_cents, qty: l.qty })), subtotal: total, voucher_cents: voucherApplied, discount_cents: jurorDiscount, due, fulfilment: type }
        : { type: "idle" },
    );
  }, [lines, total, voucherApplied, jurorDiscount, due, type]);

  function add(i: Item) {
    setLines((prev) => {
      const at = prev.findIndex((l) => l.id === i.id);
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at], qty: next[at].qty + 1 };
        return next;
      }
      return [...prev, { id: i.id, name: i.name, price_cents: i.price_cents, qty: 1, is_beverage: i.is_beverage }];
    });
  }
  function bump(id: string, d: number) {
    setLines((prev) => prev.flatMap((l) => (l.id === id ? (l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }]) : [l])));
  }

  const basket = useCallback(
    () => ({
      idempotency_key: crypto.randomUUID(),
      shift_id: shift?.id ?? "",
      customer_name: name.trim() || "Counter",
      type,
      table_number: table.trim() || undefined,
      pos_terminal: side,
      voucher_code: voucher?.code,
      items: lines.map((l) => ({ menu_item_id: l.id, qty: l.qty })),
    }),
    [lines, name, shift, side, table, type, voucher],
  );

  const completed = useCallback(
    (res: { order_id: string; order_number: number; total_cents: number; voucher_cents: number; voucher_code?: string | null }, payment_method: "cash" | "card" | "voucher") => {
      setLastOrder({ n: res.order_number, total: res.total_cents, id: res.order_id });
      postToDisplay({ type: "paid", order_number: res.order_number, total: res.total_cents, method: payment_method });
      toast.success(`Order #${res.order_number} sent to the kitchen · ${money(res.total_cents)}`);
      const printed = iminPrintTickets(
          (["KITCHEN", "COUNTER"] as const).map((heading) => ({
            heading,
            order_number: res.order_number,
            fulfilment: FULFIL.find((f) => f.id === type)?.label ?? type,
            terminal: SIDE_LABEL[side],
            lines: lines.map((l) => ({ name: l.name, qty: l.qty, price_cents: heading === "COUNTER" ? l.price_cents : undefined })),
            total_cents: heading === "COUNTER" ? res.total_cents : undefined,
            footer: heading === "COUNTER" ? "Thank you — cafe1stalbans.co.uk" : undefined,
          })),
      );
      if (!printed) window.open(`/print/${res.order_id}`, "_blank");
      if (res.voucher_cents > 0) toast.success(`Juror voucher ${res.voucher_code ?? ""} — ${money(res.voucher_cents)} redeemed`);
      setLines([]); setName(""); setTable(""); setPay(null); setTendered(0); setShowOrder(false); setVoucher(null); setPrepared(null);
    },
    [lines, side, type],
  );

  /** Cash, voucher-covered and manual (external terminal) card settlement. */
  const finish = useCallback(
    async (payment_method: "cash" | "card", manual_card_reference?: string) => {
      if (!shift) return toast.error("Open a till shift first");
      setBusy(true);
      try {
        const res = await create({
          data: { ...basket(), payment_method, manual_card_reference },
        });
        completed(res, due === 0 ? "voucher" : payment_method);
        if (payment_method === "cash") void openCashDrawer();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not take that order");
      } finally {
        setBusy(false);
      }
    },
    [basket, completed, create, due, shift],
  );

  /** Prepares the order server-side, then hands it to the SumUp Solo reader. */
  const beginReader = useCallback(async () => {
    if (!shift) return toast.error("Open a till shift first");
    setBusy(true);
    try {
      const res = await prepare({ data: basket() });
      setPrepared({
        order_id: res.order_id,
        order_number: res.order_number,
        total_cents: res.total_cents,
        voucher_cents: res.voucher_cents,
        juror_discount_cents: res.juror_discount_cents,
      });
      setPay("reader");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start that card payment");
    } finally {
      setBusy(false);
    }
  }, [basket, prepare, shift]);

  const abandonPrepared = useCallback(
    async (reason: string) => {
      const order = prepared;
      setPay(null);
      setPrepared(null);
      if (!order) return;
      try {
        await cancelOrder({ data: { order_id: order.order_id, reason } });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not release that order");
      }
    },
    [cancelOrder, prepared],
  );

  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;
  if (shiftLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-950 text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!shift) {
    return <OpenShiftScreen terminal={side} setSide={setSide} onOpened={(s) => setShift(s)} />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 text-white">
      {/* top bar */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-neutral-900 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
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
          <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 sm:inline-flex ${online ? "border-emerald-500/40 text-emerald-300" : "border-red-500/50 text-red-300"}`}>
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />} {online ? "Online" : "Offline"}
          </span>
          <button onClick={() => setClosing(true)}
            className="hidden items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 font-semibold text-white/70 hover:border-white/40 sm:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5" /> Shift open · float {money(shift.opening_float_cents)}
          </button>
          <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 sm:inline-flex ${readerId ? "border-emerald-500/40 text-emerald-300" : "border-white/15"}`}>
            <Smartphone className="h-3.5 w-3.5" />
            {readerId ? readers.find((r) => r.id === readerId)?.name ?? "Solo reader" : "No reader"}
          </span>
          <button onClick={() => void openCashDrawer().then((r) => (r.ok ? toast.success(r.message) : toast.error(r.message)))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 font-semibold text-white/80 hover:border-white/40">
            <Inbox className="h-4 w-4" /> <span className="hidden sm:inline">Drawer</span>
          </button>
          <button
            onClick={() => { const r = openCustomerScreen("/display"); r.ok ? toast.success(r.message) : toast.error(r.message); }}
            aria-label="Open the customer display on the second screen"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 font-semibold text-white/80 hover:border-white/40">
            <MonitorPlay className="h-4 w-4" /> <span className="hidden sm:inline">Screen</span>
          </button>
          <button onClick={() => setSettings(true)} aria-label="Till settings" className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 hover:border-white/40"><Settings2 className="h-4 w-4" /></button>
          <button onClick={() => setLocked(true)} aria-label="Lock till" className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 hover:border-white/40"><Lock className="h-4 w-4" /></button>
          <button onClick={() => supabase.auth.signOut()} aria-label="Sign out of the till" className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 hover:border-white/40"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[132px_minmax(0,1fr)_400px]">
        {/* category rail (desktop) */}
        <nav className="hidden min-h-0 flex-col gap-1 overflow-y-auto border-r border-white/10 bg-neutral-900/60 p-2 lg:flex">
          {cats.map((c) => (
            <button key={c.id} onClick={() => { setCatId(c.id); setQ(""); }}
              className={`shrink-0 rounded-xl px-3 py-3 text-left text-[11px] font-black uppercase leading-tight tracking-wide transition ${
                catId === c.id && !q ? "bg-primary text-primary-foreground" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}>
              {c.name}
            </button>
          ))}
        </nav>

        {/* products */}
        <section className="flex min-h-0 flex-col">
          <div className="shrink-0 space-y-3 border-b border-white/10 p-3 sm:p-4">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-neutral-900 px-4">
              <Search className="h-4 w-4 shrink-0 text-white/40" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the whole menu…"
                className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30" />
              {q && <button onClick={() => setQ("")} aria-label="Clear search"><X className="h-4 w-4 text-white/40" /></button>}
            </div>
            {!q && (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
                {cats.map((c) => (
                  <button key={c.id} onClick={() => setCatId(c.id)}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition ${catId === c.id ? "bg-white text-neutral-950" : "border border-white/10 bg-neutral-900 text-white/70"}`}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-24 sm:p-4 lg:pb-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visible.map((i) => (
                <button key={i.id} onClick={() => add(i)}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 text-left transition hover:border-primary hover:bg-neutral-800 active:scale-[0.98]">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-800">
                    {i.image_url ? (
                      <img src={i.image_url} alt={i.name} loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-white/15">
                        <UtensilsCrossed className="h-7 w-7" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-h-[64px] flex-1 flex-col justify-between gap-1 p-2.5">
                    <span className="line-clamp-2 text-[13px] font-semibold leading-snug">{i.name}</span>
                    <span className="font-display text-base font-bold text-primary">{money(i.price_cents)}</span>
                  </div>
                </button>
              ))}
              {!visible.length && <p className="text-sm text-white/40">No items.</p>}
            </div>
          </div>
        </section>

        {/* order panel */}
        <aside className={`fixed inset-0 z-40 min-h-0 flex-col bg-neutral-900 lg:static lg:z-auto lg:flex lg:border-l lg:border-white/10 ${showOrder ? "flex" : "hidden"}`}>
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 lg:hidden">
            <span className="font-display text-lg font-bold">Current order</span>
            <button onClick={() => setShowOrder(false)} aria-label="Back to menu" className="grid h-9 w-9 place-items-center rounded-lg border border-white/15">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
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

          {/* cash calculator — always visible */}
          <div className="shrink-0 border-t border-white/10 p-3">
            <div className="mb-2 grid grid-cols-3 items-end gap-2 rounded-2xl bg-neutral-800/70 px-3 py-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Tendered</p>
                <p className="text-base font-bold tabular-nums">{money(tendered)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Change</p>
                <p className={`text-base font-bold tabular-nums ${tendered - due < 0 ? "text-white/25" : "text-emerald-400"}`}>
                  {tendered === 0 || tendered - due < 0 ? "—" : money(tendered - due)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Total</p>
                <p className="font-display text-xl font-black leading-none text-primary tabular-nums">{money(due)}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button key={n} onClick={() => setTendered((t) => Math.min(t * 10 + n * 100, 5_000_00))}
                  className="h-11 rounded-xl border border-white/10 bg-neutral-800/50 text-lg font-bold hover:border-white/40 active:scale-95">{n}</button>
              ))}
              <button onClick={() => setTendered(due)}
                className="h-11 rounded-xl border border-emerald-500/40 text-xs font-black uppercase tracking-wide text-emerald-300 hover:border-emerald-400">Exact</button>
              <button onClick={() => setTendered((t) => Math.min(t * 10, 5_000_00))}
                className="h-11 rounded-xl border border-white/10 bg-neutral-800/50 text-lg font-bold hover:border-white/40 active:scale-95">0</button>
              <button onClick={() => setTendered((t) => Math.floor(t / 10 / 100) * 100)} aria-label="Delete last digit"
                className="grid h-11 place-items-center rounded-xl border border-white/10 bg-neutral-800/50 hover:border-white/40 active:scale-95"><Delete className="h-4 w-4" /></button>
              <button onClick={() => setTendered(0)}
                className="h-11 rounded-xl border border-white/10 text-xs font-black uppercase tracking-wide text-white/50 hover:border-white/40">Clear</button>
            </div>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {[500, 1000, 2000, 5000].map((v) => (
                <button key={v} onClick={() => setTendered(v)}
                  className="h-9 rounded-xl border border-white/10 text-xs font-bold text-white/70 hover:border-white/40">{money(v)}</button>
              ))}
            </div>
          </div>

          {(voucher || lines.length > 0) && (
            <div className="shrink-0 space-y-1.5 border-t border-white/10 px-3 pt-2 text-sm">
              {voucher ? (
                <>
                  <div className="flex items-center justify-between text-white/60">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-300">
                      <Ticket className="h-3.5 w-3.5" /> Juror {voucher.code}
                    </span>
                    <button onClick={() => setVoucher(null)} className="text-xs font-semibold text-white/40 underline">Remove</button>
                  </div>
                  <div className="flex justify-between text-white/70"><span>Subtotal</span><span className="tabular-nums">{money(total)}</span></div>
                  <div className="flex justify-between text-indigo-300"><span>Voucher allowance</span><span className="tabular-nums">−{money(voucherApplied)}</span></div>
                  {jurorDiscount > 0 && (
                    <div className="flex justify-between text-indigo-300"><span>Juror {JUROR_FOOD_DISCOUNT_PERCENT}% off food</span><span className="tabular-nums">−{money(jurorDiscount)}</span></div>
                  )}
                </>
              ) : (
                <button onClick={() => setVoucherOpen(true)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/40 text-xs font-bold uppercase tracking-wide text-indigo-300 hover:border-indigo-400">
                  <Ticket className="h-4 w-4" /> Juror voucher
                </button>
              )}
            </div>
          )}

          <div className="shrink-0 space-y-2 border-t border-white/10 p-3">
            {lines.length > 0 && due === 0 ? (
              <button disabled={busy} onClick={() => void finish("cash")}
                className="inline-flex h-14 w-full items-center justify-between gap-2 rounded-xl bg-indigo-600 px-5 text-base font-bold text-white disabled:opacity-40">
                <span className="inline-flex items-center gap-2"><Ticket className="h-5 w-5" /> Complete voucher order</span>
                <span className="font-display text-lg font-black tabular-nums">{money(0)}</span>
              </button>
            ) : (
              <button disabled={!lines.length || busy} onClick={() => void beginReader()}
                className="inline-flex h-14 w-full items-center justify-between gap-2 rounded-xl bg-primary px-5 text-base font-bold text-primary-foreground disabled:opacity-40">
                <span className="inline-flex items-center gap-2">
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Smartphone className="h-5 w-5" />} Charge SumUp Solo
                </span>
                <span className="font-display text-lg font-black tabular-nums">{money(due)}</span>
              </button>
            )}
            {due > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <button disabled={!lines.length || busy} onClick={() => { if (tendered && tendered < due) return toast.error("Tendered is less than the amount due"); void finish("cash"); }}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-40">
                  <Banknote className="h-4 w-4" /> Cash
                </button>
                <button onClick={() => void openCashDrawer().then((r) => (r.ok ? toast.success(r.message) : toast.error(r.message)))}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-bold text-white/80 hover:border-white/40">
                  <Inbox className="h-4 w-4" /> Drawer
                </button>
                <button disabled={!lines.length || busy} onClick={() => setPay("manual")}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-bold text-white/80 disabled:opacity-40">
                  <CreditCard className="h-4 w-4" /> Card
                </button>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <button disabled={!lines.length} onClick={() => { setLines([]); setTendered(0); }}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold text-white/40 hover:text-white disabled:opacity-40">
                <Trash2 className="h-3.5 w-3.5" /> Clear order
              </button>
              {lastOrder && (
                <button onClick={() => window.open(`/print/${lastOrder.id}`, "_blank")}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold text-white/40 hover:text-white">
                  <Printer className="h-3.5 w-3.5" /> Reprint #{lastOrder.n}
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* mobile order bar */}
      {!showOrder && (
        <button onClick={() => setShowOrder(true)}
          className="fixed inset-x-3 bottom-3 z-30 flex h-14 items-center justify-between rounded-2xl bg-primary px-5 text-primary-foreground shadow-2xl lg:hidden">
          <span className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <ReceiptText className="h-5 w-5" /> {count} item{count === 1 ? "" : "s"}
          </span>
          <span className="font-display text-xl font-black tabular-nums">{money(total)}</span>
        </button>
      )}

      {pay === "manual" && (
        <ManualCardModal due={due} busy={busy} onClose={() => setPay(null)} onConfirm={(ref) => void finish("card", ref)} />
      )}
      {pay === "reader" && prepared && (
        <ReaderPay
          total={prepared.total_cents}
          orderId={prepared.order_id}
          readers={readers}
          readerId={readerId}
          setReaderId={setReaderId}
          onClose={(reason) => void abandonPrepared(reason)}
          onPaid={async (attemptId) => {
            try {
              const res = await finalizeCard({ data: { order_id: prepared.order_id, payment_attempt_id: attemptId } });
              completed(res, "card");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Payment taken but the order could not be finalised");
            }
          }}
          onSettings={() => { setPay(null); setSettings(true); }}
        />
      )}
      {closing && shift && (
        <CloseShiftModal shift={shift} onClose={() => setClosing(false)} onClosed={() => { setClosing(false); setShift(null); }} />
      )}
      {voucherOpen && (
        <VoucherModal
          onClose={() => { setVoucherOpen(false); postToDisplay(lines.length ? { type: "order" as const, lines: lines.map((l) => ({ id: l.id, name: l.name, price_cents: l.price_cents, qty: l.qty })), subtotal: total, voucher_cents: voucherApplied, discount_cents: jurorDiscount, due, fulfilment: type } : { type: "idle" }); }}
          onApply={(v) => { setVoucher(v); setVoucherOpen(false); }}
        />
      )}
      {settings && (
        <TillSettings readers={readers} readerError={readerError} reload={loadReaders} onClose={() => setSettings(false)} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------- widgets */

function OpenShiftScreen({
  terminal, setSide, onOpened,
}: { terminal: Side; setSide: (s: Side) => void; onOpened: (s: Shift) => void }) {
  const openFn = useServerFn(openTillShift);
  const [float, setFloat] = useState("");
  const [busy, setBusy] = useState(false);

  async function open() {
    const cents = Math.round(Number(float || 0) * 100);
    if (!Number.isFinite(cents) || cents < 0) return toast.error("Enter the opening float");
    setBusy(true);
    try {
      const s = (await openFn({ data: { terminal, opening_float_cents: cents } })) as Shift;
      toast.success("Till shift open");
      onOpened(s);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the shift");
    } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-neutral-950 p-4 text-white">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900 p-6">
        <h1 className="font-display text-2xl font-black">Open the till</h1>
        <p className="mt-1 text-sm text-white/50">Count the cash drawer before you start serving.</p>

        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-white/40">Terminal</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["jury", "judge", "public"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)}
              className={`rounded-xl px-2 py-2.5 text-xs font-black uppercase tracking-wide transition ${terminal === s ? SIDE_TONE[s] : "border border-white/15 text-white/60 hover:border-white/40"}`}>
              {SIDE_LABEL[s]}
            </button>
          ))}
        </div>

        <label htmlFor="float" className="mt-5 block text-xs font-bold uppercase tracking-widest text-white/40">Opening float (£)</label>
        <input id="float" type="number" min={0} step="0.01" inputMode="decimal" value={float}
          onChange={(e) => setFloat(e.target.value)} placeholder="0.00"
          className="mt-2 h-14 w-full rounded-xl border border-white/15 bg-neutral-800 px-4 font-display text-2xl font-black tabular-nums outline-none focus:border-primary" />

        <button disabled={busy} onClick={() => void open()}
          className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-40">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />} Start shift
        </button>
        <button onClick={() => supabase.auth.signOut()} className="mt-3 w-full text-xs font-semibold text-white/40 underline">Sign out</button>
      </div>
    </div>
  );
}

function CloseShiftModal({ shift, onClose, onClosed }: { shift: Shift; onClose: () => void; onClosed: () => void }) {
  const closeFn = useServerFn(closeTillShift);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    const cents = Math.round(Number(counted || 0) * 100);
    if (!Number.isFinite(cents) || cents < 0) return toast.error("Enter the counted cash");
    setBusy(true);
    try {
      const s = (await closeFn({ data: { shift_id: shift.id, counted_cash_cents: cents, note: note.trim() } })) as Shift;
      const diff = s.discrepancy_cents ?? 0;
      toast.success(diff === 0 ? "Shift closed and balanced" : `Shift closed · ${diff > 0 ? "over" : "short"} by ${money(Math.abs(diff))}`);
      onClosed();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not close the shift");
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Close the till" onClose={onClose}>
      <p className="text-sm text-white/60">Opening float {money(shift.opening_float_cents)}. Count everything in the drawer.</p>
      <label htmlFor="counted" className="mt-4 block text-xs font-bold uppercase tracking-widest text-white/40">Counted cash (£)</label>
      <input id="counted" type="number" min={0} step="0.01" inputMode="decimal" value={counted}
        onChange={(e) => setCounted(e.target.value)} placeholder="0.00"
        className="mt-2 h-14 w-full rounded-xl border border-white/15 bg-neutral-800 px-4 font-display text-2xl font-black tabular-nums outline-none focus:border-primary" />
      <label htmlFor="closenote" className="mt-4 block text-xs font-bold uppercase tracking-widest text-white/40">Note (optional)</label>
      <input id="closenote" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
        className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-neutral-800 px-3 text-sm outline-none focus:border-primary" />

      {confirm ? (
        <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-200">Close this shift? No more sales can be rung through until a new one is opened.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setConfirm(false)} className="h-11 rounded-xl border border-white/15 text-sm font-bold text-white/70">Keep open</button>
            <button disabled={busy} onClick={() => void run()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Close shift
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground">
          <ShieldCheck className="h-4 w-4" /> Review and close
        </button>
      )}
    </Modal>
  );
}

function ManualCardModal({ due, busy, onClose, onConfirm }: { due: number; busy: boolean; onClose: () => void; onConfirm: (ref: string) => void }) {
  const [ref, setRef] = useState("");
  return (
    <Modal title="Paid on another card machine" onClose={onClose}>
      <p className="text-sm text-white/60">Confirm once the customer&apos;s card payment has gone through on the terminal.</p>
      <div className="mt-4 rounded-2xl bg-neutral-800 p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40">Amount due</p>
        <p className="font-display text-4xl font-black text-primary">{money(due)}</p>
      </div>
      <label htmlFor="cardref" className="mt-4 block text-xs font-bold uppercase tracking-widest text-white/40">Terminal receipt reference</label>
      <input id="cardref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Last 4 of the receipt no."
        className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-neutral-800 px-3 text-sm outline-none focus:border-primary" />
      <button disabled={busy || ref.trim().length < 4} onClick={() => onConfirm(ref.trim())}
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Mark paid · {money(due)}
      </button>
    </Modal>
  );
}

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

function ReaderPay({
  total, orderId, readers, readerId, setReaderId, onClose, onPaid, onSettings,
}: {
  total: number;
  orderId: string;
  readers: { id: string; name: string; status: string }[];
  readerId: string;
  setReaderId: (v: string) => void;
  onClose: (reason: string) => void;
  onPaid: (paymentAttemptId: string) => void | Promise<void>;
  onSettings: () => void;
}) {
  const start = useServerFn(startReaderPayment);
  const check = useServerFn(checkReaderPayment);
  const cancel = useServerFn(cancelReaderPayment);
  const [state, setState] = useState<"idle" | "waiting" | "failed">("idle");
  const [note, setNote] = useState("");
  const [cashPart, setCashPart] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const cardPart = Math.max(total - cashPart, 0);

  async function begin() {
    if (!readerId) return toast.error("Pick a card reader first");
    if (cashPart >= total) return toast.error("Cash split must leave at least 1p for the reader");
    setState("waiting"); setNote("Tap, insert or swipe on the Solo…");
    try {
      const started0 = await start({
        data: { reader_id: readerId, order_id: orderId, cash_component_cents: cashPart },
      });
      const payment_attempt_id = started0.payment_attempt_id;
      setAttemptId(payment_attempt_id);
      const started = Date.now();
      timer.current = setInterval(async () => {
        try {
          const r = await check({ data: { payment_attempt_id } });
          if (r.paid) {
            if (timer.current) clearInterval(timer.current);
            void onPaid(payment_attempt_id);
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
    if (readerId) {
      try {
        await cancel({ data: { reader_id: readerId, ...(attemptId ? { payment_attempt_id: attemptId } : {}) } });
      } catch { /* ignore */ }
    }
    onClose("card payment cancelled at the till");
  }

  return (
    <Modal title="Card payment on SumUp Solo" onClose={abort}>
      <div className="rounded-2xl bg-neutral-800 p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40">Charge to card</p>
        <p className="font-display text-4xl font-black text-primary">{money(cardPart)}</p>
        {cashPart > 0 && (
          <p className="mt-1 text-xs font-semibold text-emerald-300">plus {money(cashPart)} cash · total {money(total)}</p>
        )}
      </div>

      {state !== "waiting" && (
        <div className="mt-4 rounded-2xl border border-white/10 p-3">
          <label htmlFor="split-cash" className="text-xs font-bold uppercase tracking-widest text-white/40">Split with cash (optional)</label>
          <input id="split-cash" type="number" min={0} step="0.01" inputMode="decimal"
            value={cashPart ? (cashPart / 100).toFixed(2) : ""}
            placeholder="0.00"
            onChange={(e) => {
              const v = Math.round(Number(e.target.value || 0) * 100);
              setCashPart(Number.isFinite(v) && v > 0 ? Math.min(v, Math.max(total - 1, 0)) : 0);
            }}
            className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-neutral-800 px-3 text-lg font-bold tabular-nums text-white outline-none focus:border-primary" />
          <p className="mt-1.5 text-[11px] text-white/40">Take the cash first, then the reader charges the remainder.</p>
        </div>
      )}

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

function TillSettings({ readers, readerError, reload, onClose }: { readers: { id: string; name: string; status: string }[]; readerError?: string | null; reload: () => Promise<void>; onClose: () => void }) {
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40">SumUp Solo readers</p>
        <button onClick={() => void reload()} className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-bold uppercase hover:border-primary">
          Refresh
        </button>
      </div>
      {readerError && (
        <p className="mt-2 rounded-xl bg-red-500/15 p-3 text-xs text-red-300">
          SumUp connection problem: {readerError}
        </p>
      )}
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

      <p className="mt-6 text-xs font-bold uppercase tracking-widest text-white/40">Built-in printer (iMin D4-504)</p>
      <p className="mt-1 text-xs text-white/40">
        {isIminDevice()
          ? "Detected — kitchen and counter tickets print straight to this terminal."
          : "Not detected on this device — tickets open in a print window instead."}
      </p>
      <button
        onClick={() => {
          const ok = iminPrintTickets([
            { heading: "TEST TICKET", order_number: 0, fulfilment: "Dine in", terminal: "Counter", lines: [{ name: "Test print", qty: 1, price_cents: 0 }], total_cents: 0 },
          ]);
          if (ok) toast.success("Test ticket sent to the printer");
          else { window.open("/print/test?paper=58", "_blank"); toast.message("No built-in printer — opened a print preview"); }
        }}
        className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-bold hover:border-primary">
        <Printer className="h-4 w-4" /> Test print
      </button>

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

/* ------------------------------------------------------- juror voucher */

function VoucherModal({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (v: { code: string; remaining_cents: number; allocated_cents: number; opted_in: boolean }) => void;
}) {
  const lookup = useServerFn(lookupVoucher);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/juror?src=till`;

  useEffect(() => { if (url) postToDisplay({ type: "juror", url }); }, [url]);

  async function apply() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setBusy(true); setError(null);
    try {
      const res = await lookup({ data: { code: c } });
      if (!res.found) {
        setError(("message" in res && res.message) || "That voucher code isn't recognised.");
      } else if (!res.usable) {
        setError(res.message ?? "That code can't be used today.");
      } else if (res.remaining_cents <= 0) {
        setError("Today's allowance has already been used on this code.");
      } else {
        onApply({
          code: res.code,
          remaining_cents: res.remaining_cents,
          allocated_cents: res.allocated_cents,
          opted_in: res.opted_in,
        });
        toast.success(`${money(res.remaining_cents)} allowance left today`);
      }
    } catch {
      setError("Could not check that code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Juror voucher" onClose={onClose}>
      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        <div className="mx-auto w-fit rounded-2xl bg-white p-3">
          {url && <QrCode value={url} size={150} alt="Scan to open the juror voucher page" />}
        </div>
        <div className="text-sm text-white/60">
          <p className="font-semibold text-white">Ask the customer to scan</p>
          <p className="mt-1">
            The same QR is on the customer screen. Scanning opts them into the scheme and shows their remaining
            allowance — {money(JUROR_DAILY_ALLOWANCE_CENTS)} each sitting day, plus {JUROR_FOOD_DISCOUNT_PERCENT}% off
            food above it.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/40">
            <ShieldCheck className="h-3.5 w-3.5" /> Anonymous — no personal details are recorded.
          </p>
        </div>
      </div>

      <label className="mt-6 block text-xs font-bold uppercase tracking-widest text-white/50">Or key the code in</label>
      <div className="mt-2 flex gap-2">
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") void apply(); }}
          placeholder="CV-XXXXX-XXXXX"
          className="h-12 flex-1 rounded-xl border border-white/10 bg-neutral-800 px-4 font-mono text-base uppercase outline-none focus:border-primary"
        />
        <button onClick={() => void apply()} disabled={busy || !code.trim()}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} Apply
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </Modal>
  );
}
