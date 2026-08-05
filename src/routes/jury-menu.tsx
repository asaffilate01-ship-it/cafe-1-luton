import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { GatedMenuList } from "@/components/gated-menu-list";
import { OrderSetupGate } from "@/components/order-setup-gate";
import { lookupVoucher } from "@/lib/vouchers.functions";
import { jurySession, useJurySession } from "@/lib/jury-session";
import { orderContext, useOrderContext } from "@/lib/order-context";
import { JUROR_DELIVERY_VENUES, JUROR_DAILY_ALLOWANCE_CENTS } from "@/lib/juror";
import { money } from "@/lib/format";
import { ShieldCheck, Lock, LogOut, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/jury-menu")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : undefined,
    room: typeof s.room === "string" ? s.room : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Jury Only Menu — Café 1, St Albans" },
      {
        name: "description",
        content:
          "Private Jury Only menu at Café 1. Verify your anonymous juror voucher code and PIN to order for collection or delivery to the Jury Lounge at Crown Court or the Jury Rooms at the Magistrates' Court.",
      },
      { property: "og:title", content: "Jury Only Menu — Café 1, St Albans" },
      {
        property: "og:description",
        content:
          "Gated juror menu — voucher code and PIN required. Served to the Jury Lounge and Jury Rooms only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JuryMenuPage,
});

const ROOMS = [
  {
    id: "crown-lounge",
    label: "Main Jury Lounge — St Albans Crown Court",
    venue: JUROR_DELIVERY_VENUES[0],
  },
  {
    id: "crown-rooms",
    label: "Jury Rooms — St Albans Crown Court",
    venue: JUROR_DELIVERY_VENUES[0],
  },
  {
    id: "magistrates-rooms",
    label: "Jury Rooms — St Albans Magistrates' Court",
    venue: JUROR_DELIVERY_VENUES[1],
  },
] as const;

function JuryMenuPage() {
  const { code: codeParam, room: roomParam } = Route.useSearch();
  const session = useJurySession();
  const lookup = useServerFn(lookupVoucher);

  const [code, setCode] = useState((codeParam ?? "").toUpperCase());
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctx = useOrderContext();
  const [gateOpen, setGateOpen] = useState(false);

  // As soon as the Jury Only menu unlocks, ask how they'd like their order.
  useEffect(() => {
    if (session && !ctx) setGateOpen(true);
  }, [session, ctx]);

  const jurorFilter = useCallback((item: { juror_menu: boolean }) => item.juror_menu, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await lookup({ data: { code: code.trim().toUpperCase(), pin } });
      if (!res.found) {
        setError(
          ("message" in res && res.message) ||
            "That voucher code and PIN weren't recognised. Please check your juror sheet.",
        );
        return;
      }
      jurySession.set({
        code: res.code,
        remaining_cents: res.remaining_cents,
        jury_room: res.jury_room ?? roomParam ?? null,
        verified_at: Date.now(),
      });
      setPin("");
      toast.success("Verified — this is the Jury Only menu");
    } catch {
      setError("We couldn't check that code just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function chooseFulfilment(kind: "collection" | (typeof ROOMS)[number]["id"]) {
    if (kind === "collection") {
      orderContext.set({ mode: "collection", schedule_mode: "asap" });
      toast.success("Collection from Café 1");
      return;
    }
    const room = ROOMS.find((r) => r.id === kind)!;
    orderContext.set({
      mode: "delivery",
      schedule_mode: "asap",
      postcode: room.venue.postcode,
      jury_room: room.label,
    });
    toast.success(`Delivery to the ${room.label}`);
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-md px-4 py-14">
          <div className="rounded-3xl border border-border bg-card p-8 shadow-brand">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
              <Lock className="h-6 w-6" />
            </div>
            <p className="text-xs font-black uppercase tracking-[.25em] text-primary">
              Jury only menu
            </p>
            <h1 className="mt-2 font-display text-3xl font-black">Verify your voucher</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This menu is only for jurors serving at St Albans. Enter the voucher code and 6-digit
              PIN printed on your juror sheet. We never see your name or any personal details.
            </p>
            <form onSubmit={verify} className="mt-6 space-y-3">
              <input
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VOUCHER CODE"
                className="h-14 w-full rounded-2xl border border-border bg-background px-4 text-center font-mono text-xl tracking-[0.3em]"
              />
              <input
                required
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-DIGIT PIN"
                className="h-14 w-full rounded-2xl border border-border bg-background px-4 text-center font-mono text-xl tracking-[0.4em]"
              />
              {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
              <button
                disabled={busy}
                className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-brand disabled:opacity-60"
              >
                {busy ? "Checking…" : "Open the Jury Only menu"}
              </button>
            </form>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => {
                  jurySession.set({
                    code: null,
                    remaining_cents: 0,
                    jury_room: roomParam ?? null,
                    verified_at: Date.now(),
                  });
                  toast.success("Jury Only menu open — pay by card, wallet or cash");
                }}
                className="h-12 w-full rounded-full border border-primary text-sm font-bold text-primary hover:bg-primary/5"
              >
                I haven't opted in — open the menu and I'll just pay
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Every juror can order from this menu. Without the voucher scheme there's no daily
              allowance and no 10% food discount — you simply pay by card, Apple/Google Pay or cash.{" "}
              <Link to="/menu" className="font-semibold text-primary">
                Not a juror? Main menu
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border bg-primary px-4 py-8 text-primary-foreground">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-black uppercase tracking-widest">
            <ShieldCheck className="h-4 w-4" /> Jury only menu
          </span>
          <h1 className="mt-3 font-display text-4xl font-black leading-tight">
            JURY ONLY MENU — Café 1
          </h1>
          <p className="mt-3 text-primary-foreground/85">
            Served or delivered <strong>only</strong> to the Jury Lounge at St Albans Crown Court or
            the Jury Rooms at St Albans Magistrates' Court — or collect at the Café 1 counter.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            {session.code ? (
              <>
                <span className="rounded-full bg-white/15 px-3 py-1 font-mono">{session.code}</span>
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
                  {money(session.remaining_cents)} allowance left today
                </span>
              </>
            ) : (
              <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
                Paying as normal — no voucher
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                jurySession.clear();
                toast.message("Signed out of the Jury Only menu");
              }}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
            >
              <LogOut className="h-3.5 w-3.5" /> Finish
            </button>
          </div>
          <p className="mt-3 text-xs text-primary-foreground/70">
            {session.code
              ? `Daily allowance ${money(JUROR_DAILY_ALLOWANCE_CENTS)} on sitting days. Re-enter your code and PIN at checkout to apply it.`
              : "You're not on the voucher scheme, so there's no allowance or 10% food discount — pay by card, Apple/Google Pay or cash. You can opt in any time on the juror page."}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-5">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Where are you eating?
        </p>
        <button
          type="button"
          onClick={() => setGateOpen(true)}
          className="mt-2 inline-flex h-9 items-center rounded-full border border-primary px-4 text-xs font-bold text-primary hover:bg-primary/5"
        >
          {ctx ? "Change how you'd like your order" : "How would you like your order?"}
        </button>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => chooseFulfilment("collection")}
            className="rounded-2xl border border-border bg-card p-3 text-left text-sm font-semibold hover:border-primary"
          >
            Collect at Café 1
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              St Albans Crown Court
            </span>
          </button>
          {ROOMS.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => chooseFulfilment(room.id)}
              className="rounded-2xl border border-border bg-card p-3 text-left text-sm font-semibold hover:border-primary"
            >
              <Building2 className="mb-1 h-4 w-4 text-primary" />
              {room.label}
            </button>
          ))}
        </div>
      </section>

      <GatedMenuList
        filter={jurorFilter}
        emptyMessage="The Jury Only menu is being updated. Please order at the Café 1 counter today."
      />
    </div>
  );
}