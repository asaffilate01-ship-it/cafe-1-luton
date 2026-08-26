import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { useStoreStatus } from "@/hooks/use-store-status";
import { LOCATIONS, type CafeLocationId } from "@/lib/nap";

/** Live open/closed board for both Luton branches. */
export const BRANCH_SITE_IDS: Record<CafeLocationId, string> = {
  "luton-crown-court": "cafe1000-0000-4000-8000-000000000001",
  "futures-house": "bc24b444-ffc2-4912-9b0a-143513df4f20",
};

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function hhmm(value?: string | null) {
  return value ? value.slice(0, 5) : "";
}

function BranchCard({ locationId }: { locationId: CafeLocationId }) {
  const branch = LOCATIONS.find((entry) => entry.id === locationId)!;
  const { status, hours } = useStoreStatus(BRANCH_SITE_IDS[locationId]);
  const week = hours.length
    ? hours
    : branch.openingHours.flatMap((period) =>
        period.days.map((day) => ({
          day_of_week: DAY_LABELS.indexOf(day),
          open_time: period.opens,
          close_time: period.closes,
          closed: false,
        })),
      );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold">{branch.shortName}</h3>
          <p className="text-xs text-muted-foreground">
            {branch.streetAddress} · {branch.postalCode}
          </p>
        </div>
        {status.open ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Open now
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
            <XCircle className="h-4 w-4" /> Closed
          </span>
        )}
      </div>

      <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        {status.open
          ? status.todayClose
            ? `Closes ${hhmm(status.todayClose)}`
            : "Open today"
          : (status.nextOpenLabel ?? "Closed today")}
      </p>

      <dl className="mt-4 space-y-1 text-sm">
        {[1, 2, 3, 4, 5, 6, 0].map((day) => {
          const row = week.find((entry) => entry.day_of_week === day);
          const closed = !row || row.closed;
          const isToday = new Date().getDay() === day;
          return (
            <div
              key={day}
              className={`flex items-center justify-between gap-4 rounded-lg px-2 py-1 ${
                isToday ? "bg-primary/5 font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              <dt>{DAY_LABELS[day]}</dt>
              <dd>{closed ? "Closed" : `${hhmm(row.open_time)}–${hhmm(row.close_time)}`}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function BranchStatusBoard({ className = "" }: { className?: string }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>
      {LOCATIONS.map((branch) => (
        <BranchCard key={branch.id} locationId={branch.id} />
      ))}
    </div>
  );
}
