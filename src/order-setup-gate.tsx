import { useStoreStatus } from "@/hooks/use-store-status";
import { Clock, XCircle, CheckCircle2 } from "lucide-react";

export function StoreStatus({ className = "" }: { className?: string }) {
  const { status, settings } = useStoreStatus();
  const prep = settings?.prep_minutes ?? 20;
  const del = settings?.delivery_minutes ?? 15;
  if (status.open) {
    return (
      <div className={`flex flex-wrap items-center gap-3 text-sm ${className}`}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 font-semibold text-green-700">
          <CheckCircle2 className="h-4 w-4" /> Open now
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-4 w-4" /> Ready in {prep}–{prep + del} min
        </span>
        {status.todayClose && (
          <span className="text-muted-foreground">Closes {status.todayClose.slice(0,5)}</span>
        )}
      </div>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-3 text-sm ${className}`}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground">
        <XCircle className="h-4 w-4" /> {status.reason === "bank_holiday" ? `Closed — ${status.holidayName ?? "bank holiday"}` : status.reason === "closed_day" ? "Closed today" : "Closed"}
      </span>
      {status.nextOpenLabel && (
        <span className="text-muted-foreground">Opens {status.nextOpenLabel}</span>
      )}
      {settings?.allow_preorder_when_closed && (
        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">Pre-order for later ✓</span>
      )}
    </div>
  );
}