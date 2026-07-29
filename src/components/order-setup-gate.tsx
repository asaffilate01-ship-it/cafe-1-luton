import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkDeliveryPostcode } from "@/lib/delivery.functions";
import {
  orderContext,
  type OrderContext,
  type OrderMode,
  type ScheduleMode,
  useOrderContext,
} from "@/lib/order-context";
import { useStoreStatus } from "@/hooks/use-store-status";
import { buildScheduleSlots } from "@/lib/business";
import { X, MapPin, Clock, Store, Bike, Utensils } from "lucide-react";

export function OrderSetupGate({
  open,
  onClose,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  dismissible?: boolean;
}) {
  const existing = useOrderContext();
  const { status, settings, hours, holidays } = useStoreStatus();
  const checkArea = useServerFn(checkDeliveryPostcode);

  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<OrderMode>(existing?.mode ?? "collection");
  const [postcode, setPostcode] = useState(existing?.postcode ?? "");
  const [area, setArea] = useState<null | { ok: boolean; message: string; distance_m?: number }>(null);
  const [areaBusy, setAreaBusy] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(existing?.schedule_mode ?? "asap");
  const [scheduledFor, setScheduledFor] = useState<string>(existing?.scheduled_for ?? "");
  const timeSlots = useMemo(
    () => buildScheduleSlots({ hours, holidays, settings, mode }),
    [hours, holidays, settings, mode],
  );

  // Drop a previously chosen slot if it's no longer valid for this mode/day.
  useEffect(() => {
    if (scheduledFor && !timeSlots.some((s) => s.value === scheduledFor)) setScheduledFor("");
  }, [timeSlots, scheduledFor]);

  useEffect(() => {
    if (!open) setStep(1);
  }, [open]);

  async function verify() {
    const pc = postcode.trim();
    if (!pc) return;
    setAreaBusy(true);
    try {
      const res = await checkArea({ data: { postcode: pc } });
      if (res.ok) {
        setArea({
          ok: true,
          distance_m: res.distance_m ?? 0,
          message: `You're in our delivery area (${((res.distance_m ?? 0) / 1609.34).toFixed(2)} mi away).`,
        });
      } else {
        setArea({ ok: false, message: res.reason });
      }
    } catch {
      setArea({ ok: false, message: "Couldn't check that postcode. Try again." });
    } finally {
      setAreaBusy(false);
    }
  }

  function canContinueStep1() {
    if (mode !== "delivery") return true;
    return !!area?.ok;
  }

  function finish() {
    const next: OrderContext = {
      mode,
      schedule_mode: scheduleMode,
      scheduled_for: scheduleMode === "scheduled" ? scheduledFor : undefined,
      postcode: mode === "delivery" ? postcode.trim().toUpperCase() : undefined,
      distance_m: mode === "delivery" ? area?.distance_m : undefined,
    };
    orderContext.set(next);
    onClose();
  }

  const canPreorder = !!settings?.allow_preorder_when_closed;
  const forceScheduled = !status.open && canPreorder;

  useEffect(() => {
    if (forceScheduled && scheduleMode === "asap") setScheduleMode("scheduled");
  }, [forceScheduled, scheduleMode]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-primary">Cafe1</p>
            <h2 className="font-display text-lg font-bold">
              {step === 1 ? "How would you like your order?" : "When?"}
            </h2>
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-5 px-5 py-5">
          {step === 1 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { m: "collection" as const, label: "Pickup", icon: Store },
                    { m: "delivery" as const, label: "Delivery", icon: Bike },
                    { m: "dine_in" as const, label: "Dine in", icon: Utensils },
                  ]
                ).map(({ m, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => {
                      setMode(m);
                      if (m !== "delivery") setArea(null);
                    }}
                    className={`flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition ${
                      mode === m
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>

              {mode === "delivery" && (
                <div className="rounded-2xl border border-border bg-background p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <MapPin className="h-4 w-4 text-primary" /> Delivery postcode
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={postcode}
                      onChange={(e) => {
                        setPostcode(e.target.value);
                        setArea(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void verify();
                        }
                      }}
                      placeholder="e.g. AL1 3JU"
                      className="h-11 flex-1 rounded-xl border border-border bg-card px-4 uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => void verify()}
                      disabled={areaBusy || !postcode.trim()}
                      className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
                    >
                      {areaBusy ? "Checking…" : "Check"}
                    </button>
                  </div>
                  {area && (
                    <p
                      className={`mt-2 rounded-xl px-3 py-2 text-xs font-medium ${
                        area.ok
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {area.message}
                    </p>
                  )}
                  {area && !area.ok && (
                    <div className="mt-2 flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setMode("collection");
                          setArea(null);
                        }}
                        className="rounded-full border border-primary/40 px-3 py-1 font-semibold text-primary hover:bg-primary/10"
                      >
                        Switch to Pickup
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("dine_in");
                          setArea(null);
                        }}
                        className="rounded-full border border-primary/40 px-3 py-1 font-semibold text-primary hover:bg-primary/10"
                      >
                        Switch to Dine in
                      </button>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    We deliver up to ½ mile from {settings?.delivery_origin_postcode ?? "AL1 3JU"}, {(settings?.delivery_open_time ?? "08:30").slice(0, 5)}–{(settings?.delivery_close_time ?? "16:30").slice(0, 5)}.
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={!canContinueStep1()}
                onClick={() => setStep(2)}
                className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover disabled:opacity-60"
              >
                Continue
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {(["asap", "scheduled"] as const).map((s) => {
                  const disabled = s === "asap" && forceScheduled;
                  return (
                    <button
                      type="button"
                      key={s}
                      disabled={disabled}
                      onClick={() => setScheduleMode(s)}
                      className={`flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-semibold transition ${
                        scheduleMode === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <Clock className="h-4 w-4" />
                      {s === "asap" ? "ASAP (~20 min)" : "Schedule for later"}
                    </button>
                  );
                })}
              </div>

              {scheduleMode === "scheduled" && (
                <select
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="h-12 w-full rounded-xl border border-border bg-background px-4"
                >
                  <option value="">Select a time slot…</option>
                  {timeSlots.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}

              {forceScheduled && (
                <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900">
                  We're closed right now — pre-order for a later time.
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="h-12 flex-1 rounded-full border border-border font-semibold hover:bg-muted"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={finish}
                  disabled={scheduleMode === "scheduled" && !scheduledFor}
                  className="h-12 flex-[2] rounded-full bg-primary font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover disabled:opacity-60"
                >
                  Start ordering
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}