import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { lookupVoucher, optInVoucher } from "@/lib/vouchers.functions";
import { verifyJurorAttendance } from "@/lib/juror-attendance.functions";
import {
  JUROR_CODE_KEY,
  JUROR_DAILY_ALLOWANCE_CENTS,
  JUROR_EXTENDED_DAY_ALLOWANCE_CENTS,
  JUROR_FOOD_DISCOUNT_PERCENT,
} from "@/lib/juror";
import { money } from "@/lib/format";
import { toast } from "sonner";
import {
  ShieldCheck,
  Ticket,
  Clock,
  UtensilsCrossed,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Leaf,
  ArrowRight,
} from "lucide-react";

export { JUROR_CODE_KEY };

export const Route = createFileRoute("/juror")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : undefined,
    src: typeof s.src === "string" ? s.src : undefined,
    attendance:
      typeof s.attendance === "string" && /^[a-f0-9]{48}$/.test(s.attendance)
        ? s.attendance
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Juror Voucher Scheme — Café 1, St Albans Crown Court" },
      {
        name: "description",
        content:
          "Check your anonymous juror voucher code, opt into the Café 1 Juror Voucher Scheme, see today's £5.71 allowance remaining and order from the dedicated Juror Menu for collection or jury room delivery.",
      },
      { property: "og:title", content: "Juror Voucher Scheme — Café 1, St Albans Crown Court" },
      {
        property: "og:description",
        content:
          "Anonymous voucher codes, a daily allowance, a dedicated Juror Menu and 10% off food above the allowance for scheme members at Café 1.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JurorPage,
});

type Balance = Extract<Awaited<ReturnType<typeof lookupVoucher>>, { found: true }>;

function JurorPage() {
  const { code: codeParam, src, attendance } = Route.useSearch();
  const lookup = useServerFn(lookupVoucher);
  const optIn = useServerFn(optInVoucher);
  const verifyAttendance = useServerFn(verifyJurorAttendance);

  const [input, setInput] = useState(codeParam ?? "");
  const [pin, setPin] = useState("");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [optingIn, setOptingIn] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<{
    ok: boolean;
    message?: string;
    room?: string;
    verified_until?: string;
  } | null>(null);
  const attendanceAttempted = useRef(false);

  async function check(raw?: string) {
    const code = (raw ?? input).trim().toUpperCase();
    if (!code || !/^\d{6}$/.test(pin)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await lookup({ data: { code, pin } });
      if (!res.found) {
        setBalance(null);
        setError(
          ("message" in res && res.message) ||
            "Sorry, that voucher code isn't valid. Please double-check it or ask the Jury Officer.",
        );
      } else {
        setBalance(res);
        if (attendance && !attendanceAttempted.current) {
          attendanceAttempted.current = true;
          const verified = await verifyAttendance({
            data: { token: attendance, voucher_code: code, voucher_pin: pin },
          });
          setAttendanceResult(verified);
          if (verified.ok) {
            toast.success(`Attendance confirmed for ${verified.room ?? "this room"}`);
            const refreshed = await lookup({ data: { code, pin } });
            if (refreshed.found) setBalance(refreshed);
          } else toast.error(verified.message ?? "This attendance QR could not be verified");
        }
      }
    } catch {
      setError("We couldn't check that code just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Fraud control: codes are never stored on the device. Only a code passed
  // in the scanned link is pre-filled; purge anything older builds saved.
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.removeItem(JUROR_CODE_KEY);
    if (codeParam) {
      setInput(codeParam.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function join() {
    if (!balance) return;
    setOptingIn(true);
    try {
      const res = await optIn({
        data: {
          code: balance.code,
          pin,
          source: src === "till" ? "till" : src === "jury_room" ? "jury_room" : "online",
        },
      });
      if (res.ok) {
        toast.success(
          res.already
            ? "You're already on the scheme"
            : "You're on the scheme — enjoy your allowance",
        );
        await check(balance.code);
      } else toast.error(res.message);
    } finally {
      setOptingIn(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        {/* hero */}
        <section className="border-b border-border bg-primary text-primary-foreground">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-black uppercase tracking-widest">
              <ShieldCheck className="h-4 w-4" /> HMCTS juror scheme
            </span>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight sm:text-5xl">
              Café 1 Juror Voucher Scheme
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-primary-foreground/85">
              A {money(JUROR_DAILY_ALLOWANCE_CENTS)} allowance for every sitting day of your jury
              service, redeemable at Café 1 inside St Albans Crown Court. Completely anonymous — we
              only ever see your voucher code, never your name or any personal details.
            </p>
            <Link
              to="/juror-demo"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-white/15 px-5 font-bold text-primary-foreground hover:bg-white/25"
            >
              See how the whole scheme works <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* code panel */}
        <section className="mx-auto -mt-8 max-w-3xl px-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
            <label
              htmlFor="juror-code"
              className="text-xs font-black uppercase tracking-widest text-muted-foreground"
            >
              Your voucher code
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px_auto]">
              <input
                id="juror-code"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void check();
                }}
                placeholder="CV-XXXXX-XXXXX"
                className="h-12 flex-1 rounded-xl border border-border bg-background px-4 font-mono text-lg uppercase tracking-wider outline-none focus:border-primary"
              />
              <input
                aria-label="Six-digit voucher PIN"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void check();
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6-digit PIN"
                className="h-12 rounded-xl border border-border bg-background px-4 text-center font-mono text-lg tracking-widest outline-none focus:border-primary"
              />
              <button
                onClick={() => void check()}
                disabled={busy || !input.trim() || pin.length !== 6}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Ticket className="h-4 w-4" />
                )}{" "}
                Check balance
              </button>
            </div>
            {error && (
              <p className="mt-3 inline-flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}
            {attendance && !balance && !error && (
              <p className="mt-3 text-sm text-muted-foreground">
                Enter your anonymous voucher code to finish the one-time attendance check.
              </p>
            )}

            {attendanceResult && (
              <div
                className={`mt-4 rounded-xl border p-4 text-sm ${
                  attendanceResult.ok
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-amber-300 bg-amber-50 text-amber-900"
                }`}
                role="status"
              >
                <p className="font-semibold">
                  {attendanceResult.ok
                    ? `Attendance confirmed${attendanceResult.room ? ` · ${attendanceResult.room}` : ""}`
                    : "Attendance QR not accepted"}
                </p>
                <p className="mt-1">
                  {attendanceResult.ok
                    ? "Only your anonymous voucher reference and approved room are recorded."
                    : (attendanceResult.message ?? "Ask the Jury Officer to display a fresh QR.")}
                </p>
              </div>
            )}

            {balance && (
              <div className="mt-6 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label="Today's allowance" value={money(balance.allocated_cents)} />
                  <Stat label="Used today" value={money(balance.used_cents)} />
                  <Stat label="Left today" value={money(balance.remaining_cents)} highlight />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                    <Clock className="h-3.5 w-3.5" />
                    Valid until{" "}
                    {balance.valid_until
                      ? new Date(balance.valid_until).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}
                  </span>
                  {balance.jury_room && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                      <Building2 className="h-3.5 w-3.5" /> {balance.jury_room}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${balance.opted_in ? "bg-emerald-100 text-emerald-800" : "bg-muted"}`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                    {balance.opted_in ? "Opted in" : "Not yet opted in"}
                  </span>
                  {balance.attendance_required && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${balance.attendance_verified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      {balance.attendance_verified
                        ? "Attendance confirmed today"
                        : "Attendance scan required for online use"}
                    </span>
                  )}
                </div>

                {balance.message && (
                  <p className="rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                    {balance.message}
                  </p>
                )}

                {!balance.opted_in && balance.usable && (
                  <>
                  <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <strong>Please read before opting in.</strong> Joining the voucher scheme means
                    you take your food and drink through Café 1 for the rest of your jury service
                    and <strong>will not claim HMCTS subsistence expenses</strong> during that time.
                    It is one or the other — you cannot use both schemes or mix them.
                  </p>
                  <button
                    onClick={() => void join()}
                    disabled={optingIn}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {optingIn ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Opt in — voucher scheme instead of expenses
                  </button>
                  </>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <Link
                    to="/menu"
                    search={{ juror: true } as never}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-primary font-bold text-primary hover:bg-primary/5"
                  >
                    <UtensilsCrossed className="h-4 w-4" /> Juror Menu
                  </Link>
                  <Link
                    to="/menu"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border font-bold hover:border-primary"
                  >
                    Order to my jury room <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your allowance is applied automatically at the checkout and at the till. Anything
                  above it is paid by you — with {JUROR_FOOD_DISCOUNT_PERCENT}% off food as a scheme
                  member.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* how it works */}
        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="font-display text-3xl font-black">How the scheme works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card icon={Ticket} title="1. Your code">
              The Jury Officer gives you an anonymous voucher code with your induction paperwork.
              Café 1 never receives your name or any personal details — only the code.
            </Card>
            <Card icon={ShieldCheck} title="2. Opt in once">
              Scan the QR code at the Café 1 till, or on the customer screen, and enter your code.
              Opting in means you take the voucher scheme instead of claiming HMCTS subsistence
              expenses for the rest of your service — one or the other, never both.
            </Card>
            <Card icon={UtensilsCrossed} title="3. Use it daily">
              {money(JUROR_DAILY_ALLOWANCE_CENTS)} each sitting day, usable across as many purchases
              as you like. Unused value expires at the end of the day and can&apos;t be carried over
              or exchanged for cash.
            </Card>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Card icon={Leaf} title="Dedicated Juror Menu">
              Hot meals, cold meals, sandwiches and baguettes, vegetarian options, snacks and hot
              and cold drinks — with daily and weekly Juror Offers that change regularly. The Juror
              Menu is open to all jurors, whether or not you join the scheme.
            </Card>
            <Card icon={Building2} title="Sitting in the Magistrates' Court?">
              Scan the QR code in the jury room to order online, enter your code, choose your jury
              room and a delivery time. We&apos;ll bring it to you.
            </Card>
            <Card icon={UtensilsCrossed} title="Dietary requirements & allergies">
              Tell us in the notes box when you order, or speak to us at the counter, and we&apos;ll
              make every reasonable effort to have suitable options available throughout your
              service.
            </Card>
            <Card icon={ShieldCheck} title="Fully auditable">
              Every redemption records the voucher reference, date, time, receipt number, amount
              redeemed and any balance you paid — so HMCTS receives a single, fully reconciled
              claim.
            </Card>
            <Card icon={Clock} title="Long court days">
              If the Jury Officer confirms that attendance exceeded 10 hours, a manager can raise
              that day&apos;s food-and-drink allowance to{" "}
              {money(JUROR_EXTENDED_DAY_ALLOWANCE_CENTS)}. It cannot be increased by the juror or
              ordinary till staff.
            </Card>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${highlight ? "border-primary bg-primary/5" : "border-border"}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-2xl font-black tabular-nums ${highlight ? "text-primary" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Ticket;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Icon className="h-6 w-6 text-primary" />
      <h3 className="mt-3 font-display text-lg font-bold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
