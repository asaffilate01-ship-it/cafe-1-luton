import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import {
  CheckCircle2,
  ShoppingBag,
  HandPlatter,
  Bike,
  UtensilsCrossed,
  Delete,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  announceDisplayPresence,
  postToDisplay,
  subscribeToDisplay,
  type DisplayLine,
  type DisplayMessage,
} from "@/lib/customer-display";
import { QrCode } from "@/components/qr-code";
import { JUROR_DAILY_ALLOWANCE_CENTS } from "@/lib/juror";
import { lookupVoucher, optInVoucher } from "@/lib/vouchers.functions";
import { useCustomerDisplayRelay } from "@/hooks/use-customer-display-relay";
import type { RemoteDisplayMessage } from "@/lib/customer-display-relay";

export const Route = createFileRoute("/display")({
  head: () => ({
    meta: [
      { title: "Customer display — Cafe 1 St Albans" },
      {
        name: "description",
        content:
          "Second-screen customer display for Cafe 1 at St Albans Crown Court: shows the live order at the counter and plays cafe adverts between sales.",
      },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer" },
      { property: "og:title", content: "Customer display — Cafe 1 St Albans" },
      { property: "og:description", content: "Counter-facing order and advert screen for Cafe 1." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DisplayPage,
});

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  image_url: string | null;
  bg_color: string | null;
};

const FULFIL_ICON: Record<string, typeof ShoppingBag> = {
  dine_in: HandPlatter,
  collection: ShoppingBag,
  delivery: Bike,
};
const FULFIL_LABEL: Record<string, string> = {
  dine_in: "Dine in",
  collection: "Takeaway",
  delivery: "Delivery",
};

function DisplayPage() {
  const [lines, setLines] = useState<DisplayLine[]>([]);
  const [total, setTotal] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [voucherCents, setVoucherCents] = useState(0);
  const [discountCents, setDiscountCents] = useState(0);
  const [fulfilment, setFulfilment] = useState("dine_in");
  const [paid, setPaid] = useState<null | { order_number: number; total: number }>(null);
  const [jurorUrl, setJurorUrl] = useState<string | null>(null);
  const [qrScreen, setQrScreen] = useState<{
    url: string;
    title: string | null;
    subtitle: string | null;
  } | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [slide, setSlide] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const paidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDisplayMessage = useCallback((msg: DisplayMessage | RemoteDisplayMessage) => {
    if (msg.type === "juror") {
      setQrScreen(null);
      setJurorUrl(msg.url);
      return;
    }
    if (msg.type === "juror_applied") return;
    setJurorUrl(null);
    if (msg.type === "qr") {
      setQrScreen({ url: msg.url, title: msg.title ?? null, subtitle: msg.subtitle ?? null });
      return;
    }
    setQrScreen(null);
    if (msg.type === "order") {
      setPaid(null);
      setLines(msg.lines);
      setSubtotal(msg.subtotal);
      setVoucherCents(msg.voucher_cents);
      setDiscountCents(msg.discount_cents);
      setTotal(msg.due);
      setFulfilment(msg.fulfilment);
    } else if (msg.type === "paid") {
      setLines([]);
      setTotal(0);
      setSubtotal(0);
      setVoucherCents(0);
      setDiscountCents(0);
      setPaid({ order_number: msg.order_number, total: msg.total });
      if (paidTimer.current) clearTimeout(paidTimer.current);
      paidTimer.current = setTimeout(() => setPaid(null), 10_000);
    } else {
      setLines([]);
      setTotal(0);
      setSubtotal(0);
      setVoucherCents(0);
      setDiscountCents(0);
    }
  }, []);
  const displayRelay = useCustomerDisplayRelay({
    role: "display",
    onMessage: handleDisplayMessage,
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("promo_banners")
        .select("id, title, subtitle, badge, image_url, bg_color")
        .eq("active", true)
        .order("sort_order");
      setBanners((data ?? []) as Banner[]);
    })();
  }, []);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 9000);
    return () => clearInterval(t);
  }, [banners.length]);

  useEffect(() => {
    const unsubscribe = subscribeToDisplay(handleDisplayMessage);
    return () => {
      unsubscribe();
      if (paidTimer.current) clearTimeout(paidTimer.current);
    };
  }, [handleDisplayMessage]);

  useEffect(() => {
    announceDisplayPresence();
    const heartbeat = window.setInterval(announceDisplayPresence, 5_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") announceDisplayPresence();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const count = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const banner = banners[slide] ?? null;
  const Icon = FULFIL_ICON[fulfilment] ?? HandPlatter;

  /* ---- staff-triggered QR takeover ---- */
  if (qrScreen) {
    return (
      <div className="grid h-screen place-items-center bg-white px-10 py-8 text-center text-neutral-900">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-1.5 text-sm font-black uppercase tracking-[0.25em] text-primary-foreground">
            Scan with your phone
          </span>
          <h1 className="mt-5 font-display text-5xl font-black">
            {qrScreen.title ?? "Scan this code"}
          </h1>
          {qrScreen.subtitle && (
            <p className="mt-3 text-2xl text-neutral-500">{qrScreen.subtitle}</p>
          )}
          <div className="mx-auto mt-8 w-fit rounded-3xl border-4 border-neutral-900 p-5">
            <QrCode value={qrScreen.url} size={320} alt={qrScreen.title ?? "Scan this QR code"} />
          </div>
        </div>
      </div>
    );
  }

  /* ---- juror voucher QR ---- */
  if (jurorUrl) {
    return (
      <div className="grid h-screen grid-cols-1 items-center gap-8 bg-white px-10 py-8 text-neutral-900 lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-1.5 text-sm font-black uppercase tracking-[0.25em] text-primary-foreground">
            Juror voucher scheme
          </span>
          <h1 className="mt-5 font-display text-4xl font-black">
            Enter your code and PIN, or scan
          </h1>
          <p className="mt-3 text-xl text-neutral-500">
            {money(JUROR_DAILY_ALLOWANCE_CENTS)} each sitting day. Only you type the PIN — our staff
            never see it.
          </p>
          <div className="mx-auto mt-6 w-fit rounded-3xl border-4 border-neutral-900 p-4">
            <QrCode value={jurorUrl} size={220} alt="Scan to open the Cafe 1 juror voucher page" />
          </div>
          <p className="mt-5 inline-flex items-center gap-2 text-base text-neutral-400">
            <ShieldCheck className="h-4 w-4" /> Anonymous — Cafe 1 never sees your name.
          </p>
        </div>
        <JurorKeypad />
      </div>
    );
  }

  /* ---- thank you ---- */
  if (paid) {
    return (
      <div className="grid h-screen place-items-center bg-neutral-950 px-8 text-center text-white">
        <div>
          <CheckCircle2 className="mx-auto h-24 w-24 text-emerald-400" />
          <h1 className="mt-6 font-display text-6xl font-black">Thank you!</h1>
          <p className="mt-3 text-2xl text-white/60">
            Order #{paid.order_number} · {money(paid.total)}
          </p>
          <p className="mt-8 text-lg text-white/40">
            We&apos;ll call your number when it&apos;s ready.
          </p>
        </div>
      </div>
    );
  }

  /* ---- idle advert reel ---- */
  if (!lines.length) {
    return (
      <div className="relative h-screen overflow-hidden bg-neutral-950 text-white">
        {banner?.image_url ? (
          <img
            key={banner.id}
            src={banner.image_url}
            alt={banner.title}
            className="absolute inset-0 h-full w-full animate-[fade-in_0.8s_ease-out] object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-red-800 to-neutral-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/50" />

        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-primary px-6 py-2 text-lg font-black uppercase tracking-[0.3em] text-primary-foreground">
              Cafe 1
            </span>
            <span className="text-2xl font-semibold text-white/70" suppressHydrationWarning>
              {now ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}
            </span>
          </div>

          <div className="max-w-4xl">
            {banner?.badge && (
              <span className="inline-block rounded-full bg-white/15 px-5 py-1.5 text-base font-bold uppercase tracking-widest backdrop-blur">
                {banner.badge}
              </span>
            )}
            <h1 className="mt-4 font-display text-7xl font-black leading-[1.02] drop-shadow-lg">
              {banner?.title ?? "Freshly made, all day"}
            </h1>
            <p className="mt-4 text-3xl text-white/75">
              {banner?.subtitle ??
                "Breakfasts, paninis, parathas, cakes and proper Italian coffee — open to the public."}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xl text-white/50">St Albans Crown Court · cafe1stalbans.co.uk</p>
            <div className="flex items-center gap-4">
              <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white/55 backdrop-blur">
                {displayRelay.configured
                  ? displayRelay.channelStatus === "connected"
                    ? "Secure till relay"
                    : "Relay reconnecting"
                  : "Pair in Till settings"}
              </span>
              <div className="flex gap-2">
                {banners.map((b, i) => (
                  <span
                    key={b.id}
                    className={`h-2 rounded-full transition-all ${i === slide ? "w-10 bg-primary" : "w-2 bg-white/30"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---- live order (items only — adverts pause so the screen never jumps) ---- */
  return (
    <div className="h-screen overflow-hidden bg-neutral-950 text-white">
      <section className="mx-auto flex h-full min-h-0 max-w-5xl flex-col p-8">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-primary px-5 py-1.5 text-base font-black uppercase tracking-[0.25em] text-primary-foreground">
            Your order
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-lg font-semibold text-white/70">
            <Icon className="h-5 w-5" /> {FULFIL_LABEL[fulfilment] ?? "Dine in"}
          </span>
        </div>

        <ul className="mt-6 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
          {lines.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-4 rounded-2xl bg-white/5 px-5 py-4 text-2xl"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary font-black text-primary-foreground">
                {l.qty}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{l.name}</span>
              <span className="shrink-0 font-bold tabular-nums">
                {money(l.price_cents * l.qty)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-end justify-between border-t border-white/10 pt-6">
          <span className="text-xl font-bold uppercase tracking-widest text-white/50">
            {count} item{count === 1 ? "" : "s"}
          </span>
          <div className="text-right">
            {(voucherCents > 0 || discountCents > 0) && (
              <div className="mb-2 space-y-1 text-xl font-semibold tabular-nums text-white/60">
                <div>
                  Subtotal <span className="ml-3">{money(subtotal)}</span>
                </div>
                {voucherCents > 0 && (
                  <div className="text-emerald-400">
                    Juror voucher <span className="ml-3">−{money(voucherCents)}</span>
                  </div>
                )}
                {discountCents > 0 && (
                  <div className="text-emerald-400">
                    Juror discount <span className="ml-3">−{money(discountCents)}</span>
                  </div>
                )}
              </div>
            )}
            <span className="font-display text-7xl font-black tabular-nums text-primary">
              {money(total)}
            </span>
          </div>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden border-l border-white/10 lg:block">
        {banner?.image_url ? (
          <img src={banner.image_url} alt={banner.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary via-red-800 to-neutral-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8">
          {banner?.badge && (
            <span className="inline-block rounded-full bg-white/15 px-4 py-1 text-sm font-bold uppercase tracking-widest">
              {banner.badge}
            </span>
          )}
          <p className="mt-3 font-display text-4xl font-black leading-tight">
            {banner?.title ?? "Made fresh at Cafe 1"}
          </p>
          {banner?.subtitle && <p className="mt-2 text-xl text-white/70">{banner.subtitle}</p>}
          {!banner && (
            <p className="mt-2 inline-flex items-center gap-2 text-xl text-white/70">
              <UtensilsCrossed className="h-5 w-5" /> Ask about today&apos;s specials
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------- juror keypad (customer) */

function JurorKeypad() {
  const lookup = useServerFn(lookupVoucher);
  const optIn = useServerFn(optInVoucher);
  const [field, setField] = useState<"code" | "pin">("code");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<null | { remaining: number; opted_in: boolean }>(null);

  function press(key: string) {
    setError(null);
    if (field === "code") setCode((c) => (c + key).slice(0, 24).toUpperCase());
    else setPin((p) => (p + key.replace(/\D/g, "")).slice(0, 6));
  }
  function back() {
    setError(null);
    if (field === "code") setCode((c) => c.slice(0, -1));
    else setPin((p) => p.slice(0, -1));
  }

  async function submit() {
    const c = code.trim().toUpperCase();
    if (!c || pin.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const res = await lookup({ data: { code: c, pin } });
      if (!res.found) {
        setError(
          ("message" in res && res.message) || "Sorry, that code and PIN aren't recognised.",
        );
      } else if (!res.usable) {
        setError(res.message ?? "Sorry, that code can't be used today.");
      } else if (res.remaining_cents <= 0) {
        setError("Today's allowance has already been used on this code.");
      } else {
        postToDisplay({
          type: "juror_applied",
          code: res.code,
          pin,
          remaining_cents: res.remaining_cents,
          allocated_cents: res.allocated_cents,
          opted_in: res.opted_in,
        });
        setApplied({ remaining: res.remaining_cents, opted_in: res.opted_in });
      }
    } catch {
      setError("Sorry, we couldn't check that just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (applied) {
    return (
      <div className="rounded-3xl border-4 border-emerald-500 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
        <p className="mt-4 font-display text-3xl font-black text-emerald-900">Voucher applied</p>
        <p className="mt-2 text-xl text-emerald-800">
          {money(applied.remaining)} allowance left today
        </p>
        {!applied.opted_in && (
          <>
            <p className="mt-5 text-base text-emerald-900">
              Opt in to the scheme for {money(JUROR_DAILY_ALLOWANCE_CENTS)} each sitting day plus
              10% off food. Opting in means you will not claim HMCTS subsistence expenses during
              your service.
            </p>
            <button
              onClick={async () => {
                await optIn({ data: { code, pin, source: "display" } });
                setApplied((a) => (a ? { ...a, opted_in: true } : a));
              }}
              className="mt-4 h-14 w-full rounded-2xl bg-emerald-600 text-lg font-black text-white"
            >
              Opt in to the voucher scheme
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border-2 border-neutral-200 bg-neutral-50 p-6 shadow-sm">
      <button
        onClick={() => setField("code")}
        className={`flex h-14 w-full items-center rounded-2xl border-2 px-4 font-mono text-xl ${field === "code" ? "border-primary bg-white" : "border-neutral-200 bg-white/60"}`}
      >
        {code || <span className="text-neutral-400">Voucher code</span>}
      </button>
      <button
        onClick={() => setField("pin")}
        className={`mt-3 flex h-14 w-full items-center justify-center rounded-2xl border-2 font-mono text-2xl tracking-[0.5em] ${field === "pin" ? "border-primary bg-white" : "border-neutral-200 bg-white/60"}`}
      >
        {pin ? (
          "•".repeat(pin.length)
        ) : (
          <span className="tracking-normal text-neutral-400">6-digit PIN</span>
        )}
      </button>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
          <KeyBtn key={k} onClick={() => press(k)}>
            {k}
          </KeyBtn>
        ))}
        <KeyBtn onClick={back}>
          <Delete className="mx-auto h-6 w-6" />
        </KeyBtn>
        <KeyBtn onClick={() => press("0")}>0</KeyBtn>
        <KeyBtn onClick={() => press("-")} disabled={field === "pin"}>
          −
        </KeyBtn>
      </div>

      {field === "code" && (
        <div className="mt-2 grid grid-cols-7 gap-1">
          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              className="h-10 rounded-lg bg-white font-bold text-neutral-700 shadow-sm active:bg-neutral-200"
            >
              {k}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-center text-base font-semibold text-red-600">{error}</p>}

      <button
        onClick={() => void submit()}
        disabled={busy || !code.trim() || pin.length !== 6}
        className="mt-4 inline-flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-black text-primary-foreground disabled:opacity-40"
      >
        {busy && <Loader2 className="h-5 w-5 animate-spin" />} Use my voucher
      </button>
    </div>
  );
}

function KeyBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-16 rounded-2xl bg-white text-2xl font-black text-neutral-900 shadow-sm active:bg-neutral-200 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
