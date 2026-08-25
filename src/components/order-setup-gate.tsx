import { useEffect, useMemo, useState } from "react";
import { Building2, Clock, Eye, MapPin, Store, Utensils, X } from "lucide-react";

import { useStoreStatus } from "@/hooks/use-store-status";
import { buildScheduleSlots, computeStoreStatus } from "@/lib/business";
import { LOCATIONS, orderingHoursForLocation, type CafeLocationId } from "@/lib/nap";
import {
  orderContext,
  type OrderContext,
  type ScheduleMode,
  useOrderContext,
} from "@/lib/order-context";

type PublicOrderMode = "collection" | "dine_in";

/** Internal court destinations used by the Crown Court jury workflow only. */
export const JURY_DELIVERY_ROOMS = [
  { id: "crown-lounge", label: "Main Jury Lounge — Luton Crown Court", postcode: "LU1 2AA" },
  { id: "crown-rooms", label: "Jury Rooms — Luton Crown Court", postcode: "LU1 2AA" },
  {
    id: "magistrates-rooms",
    label: "Jury Rooms — Luton Magistrates' Court",
    postcode: "LU1 5BL",
  },
] as const;

export function OrderSetupGate({
  open,
  onClose,
  onBrowse,
  dismissible = true,
  juryOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  /** Public menu only: leave without creating an order context. */
  onBrowse?: () => void;
  dismissible?: boolean;
  /** Crown Court-only flow; the detailed jury destinations remain on /jury-menu. */
  juryOnly?: boolean;
}) {
  const existing = useOrderContext();
  const { status: defaultStatus, settings, hours, holidays } = useStoreStatus();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [location, setLocation] = useState<CafeLocationId | null>(existing?.location ?? null);
  const [mode, setMode] = useState<PublicOrderMode>(
    existing?.mode === "dine_in" ? "dine_in" : "collection",
  );
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(existing?.schedule_mode ?? "asap");
  const [scheduledFor, setScheduledFor] = useState(existing?.scheduled_for ?? "");
  const branchHours = useMemo(
    () => (location ? orderingHoursForLocation(location) : hours),
    [hours, location],
  );
  const status = useMemo(
    () =>
      location ? computeStoreStatus(branchHours, settings, new Date(), holidays) : defaultStatus,
    [branchHours, defaultStatus, holidays, location, settings],
  );
  const timeSlots = useMemo(
    () =>
      buildScheduleSlots({
        hours: branchHours,
        holidays,
        settings,
        mode,
        intervalMinutes: 15,
        openOffsetMinutes: 15,
        closeOffsetMinutes: 30,
      }),
    [branchHours, holidays, settings, mode],
  );

  useEffect(() => {
    if (scheduledFor && !timeSlots.some((slot) => slot.value === scheduledFor)) {
      setScheduledFor("");
    }
  }, [scheduledFor, timeSlots]);

  useEffect(() => {
    if (!open) setStep(1);
    else if (juryOnly) {
      setLocation("luton-crown-court");
      setStep(2);
    }
  }, [juryOnly, open]);

  const canPreorder = !!settings?.allow_preorder_when_closed;
  const forceScheduled = !status.open && canPreorder;

  useEffect(() => {
    if (forceScheduled && scheduleMode === "asap") setScheduleMode("scheduled");
  }, [forceScheduled, scheduleMode]);

  function finish() {
    if (!location) return;
    const next: OrderContext = {
      location,
      mode,
      schedule_mode: scheduleMode,
      scheduled_for: scheduleMode === "scheduled" ? scheduledFor : undefined,
    };
    orderContext.set(next);
    onClose();
  }

  if (!open) return null;

  const title = step === 1 ? "Choose your Café 1" : step === 2 ? "Dine in or takeaway?" : "When?";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-setup-title"
      onKeyDown={(event) => {
        if (event.key === "Escape" && dismissible) onClose();
      }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-primary">
              Cafe 1 Luton
            </p>
            <h2 id="order-setup-title" className="font-display text-lg font-bold">
              {title}
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
              <p className="text-sm leading-relaxed text-muted-foreground">
                Select the Luton branch you would like to visit, or browse the menu without starting
                an order.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {LOCATIONS.map((branch, index) => {
                  const Icon = index === 0 ? Building2 : MapPin;
                  const selected = location === branch.id;
                  return (
                    <button
                      type="button"
                      key={branch.id}
                      onClick={() => setLocation(branch.id)}
                      className={`flex min-h-32 flex-col items-start justify-center rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="mt-3 font-semibold">{branch.shortName}</span>
                      <span
                        className={`mt-1 text-xs ${selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                      >
                        {branch.streetAddress} · {branch.postalCode}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={!location}
                onClick={() => setStep(2)}
                className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover disabled:opacity-50"
              >
                Continue
              </button>
              {onBrowse && (
                <>
                  <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> Or
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <button
                    type="button"
                    onClick={onBrowse}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 font-semibold transition hover:border-primary hover:bg-primary/5 hover:text-primary"
                  >
                    <Eye className="h-4 w-4" /> Just browsing
                  </button>
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Online delivery is not offered. Choose how you will collect or enjoy your order at
                the selected café.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "dine_in" as const, label: "Dine in", Icon: Utensils },
                  { id: "collection" as const, label: "Takeaway", Icon: Store },
                ].map(({ id, label, Icon }) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setMode(id)}
                    className={`flex h-28 flex-col items-center justify-center gap-2 rounded-2xl border font-semibold transition ${
                      mode === id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
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
                  onClick={() => setStep(3)}
                  className="h-12 flex-[2] rounded-full bg-primary font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {(["asap", "scheduled"] as const).map((schedule) => {
                  const disabled = schedule === "asap" && forceScheduled;
                  return (
                    <button
                      type="button"
                      key={schedule}
                      disabled={disabled}
                      onClick={() => setScheduleMode(schedule)}
                      className={`flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-semibold transition ${
                        scheduleMode === schedule
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <Clock className="h-4 w-4" />
                      {schedule === "asap" ? "ASAP (~20 min)" : "Schedule for later"}
                    </button>
                  );
                })}
              </div>

              {scheduleMode === "scheduled" && (
                <select
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                  className="h-12 w-full rounded-xl border border-border bg-background px-4"
                >
                  <option value="">Select a time slot…</option>
                  {timeSlots.length === 0 && <option disabled>No slots available</option>}
                  {timeSlots.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              )}

              {forceScheduled && (
                <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900">
                  We&apos;re closed right now — pre-order for a later time.
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
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
