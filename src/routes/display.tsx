import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import { CheckCircle2, ShoppingBag, HandPlatter, Bike, UtensilsCrossed } from "lucide-react";
import { DISPLAY_CHANNEL, type DisplayLine, type DisplayMessage } from "@/lib/customer-display";
import { QrCode } from "@/components/qr-code";
import { JUROR_DAILY_ALLOWANCE_CENTS } from "@/lib/juror";

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
  const [banners, setBanners] = useState<Banner[]>([]);
  const [slide, setSlide] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const paidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 9000);
    return () => clearInterval(t);
  }, [banners.length]);

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const ch = new BroadcastChannel(DISPLAY_CHANNEL);
    ch.onmessage = (e: MessageEvent<DisplayMessage>) => {
      const msg = e.data;
      if (msg.type === "juror") {
        setJurorUrl(msg.url);
        return;
      }
      setJurorUrl(null);
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
    };
    return () => {
      ch.close();
      if (paidTimer.current) clearTimeout(paidTimer.current);
    };
  }, []);

  const count = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const banner = banners[slide] ?? null;
  const Icon = FULFIL_ICON[fulfilment] ?? HandPlatter;

  /* ---- juror voucher QR ---- */
  if (jurorUrl) {
    return (
      <div className="grid h-screen place-items-center bg-white px-8 text-center text-neutral-900">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-1.5 text-sm font-black uppercase tracking-[0.25em] text-primary-foreground">
            Juror voucher scheme
          </span>
          <h1 className="mt-5 font-display text-5xl font-black">Scan to use your voucher</h1>
          <p className="mt-3 text-2xl text-neutral-500">
            Scan with your phone, enter the code and separate PIN from your juror slip —{" "}
            {money(JUROR_DAILY_ALLOWANCE_CENTS)} each sitting day.
          </p>
          <div className="mx-auto mt-8 w-fit rounded-3xl border-4 border-neutral-900 p-5">
            <QrCode value={jurorUrl} size={320} alt="Scan to open the Cafe 1 juror voucher page" />
          </div>
          <p className="mt-6 text-lg text-neutral-400">
            Completely anonymous — Cafe 1 never sees your name or personal details.
          </p>
        </div>
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
            <span className="text-2xl font-semibold text-white/70">
              {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
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
    );
  }

  /* ---- live order + advert side panel ---- */
  return (
    <div className="grid h-screen grid-cols-1 overflow-hidden bg-neutral-950 text-white lg:grid-cols-[1fr_38%]">
      <section className="flex min-h-0 flex-col p-8">
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
