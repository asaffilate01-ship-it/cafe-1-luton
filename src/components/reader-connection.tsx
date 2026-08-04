import { Loader2, RefreshCw, Settings2, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";

export type ReaderInfo = { id: string; name: string; status: string };

/** SumUp reports paired/online devices with these labels; anything else means it is off Wi-Fi. */
export function isReaderOnline(status: string | undefined | null): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "paired" || value === "online" || value === "connected" || value === "ready";
}

export function readerStatusLabel(status: string | undefined | null): string {
  const value = (status ?? "").toLowerCase();
  if (isReaderOnline(value)) return "Online";
  if (!value || value === "unknown") return "Checking";
  if (value === "expired") return "Pairing expired";
  return "Offline";
}

/** The Wi-Fi steps staff follow on the Solo itself. */
export function WifiSetupSteps() {
  return (
    <ol className="mt-2 space-y-1.5 text-xs text-white/60">
      <li>
        <span className="font-bold text-white/80">1.</span> On the Solo: swipe down → Settings →
        Wi-Fi and join the café network (or leave mobile data on as backup).
      </li>
      <li>
        <span className="font-bold text-white/80">2.</span> Wait for the Wi-Fi icon on the Solo's
        status bar to show connected.
      </li>
      <li>
        <span className="font-bold text-white/80">3.</span> Settings → Connections → Pair device to
        get a pairing code, then enter it below.
      </li>
      <li>
        <span className="font-bold text-white/80">4.</span> Press Retry here — the reader should
        show Online.
      </li>
    </ol>
  );
}

/**
 * Shown on the card-payment screen whenever SumUp is unreachable, no reader is
 * paired, or the chosen reader has dropped off Wi-Fi.
 */
export function ReaderConnectionAlert({
  readers,
  readerId,
  error,
  onRetry,
  onSettings,
}: {
  readers: ReaderInfo[];
  readerId: string;
  error?: string | null;
  onRetry: () => Promise<void> | void;
  onSettings: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const selected = readers.find((r) => r.id === readerId);
  const problem = error
    ? "Cafe 1 cannot reach SumUp right now."
    : !readers.length
      ? "No SumUp Solo is paired to this till yet."
      : selected && !isReaderOnline(selected.status)
        ? `${selected.name} is not connected to Wi-Fi.`
        : null;
  if (!problem) return null;

  async function retry() {
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-200">
        <WifiOff className="h-4 w-4" /> Card reader not connected
      </p>
      <p className="mt-1 text-xs text-amber-100/80">{problem}</p>
      {error && <p className="mt-1 text-[11px] text-amber-100/60">{error}</p>}
      <WifiSetupSteps />
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => void retry()}
          disabled={busy}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 text-sm font-bold text-neutral-900 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Retry connection
        </button>
        <button
          onClick={onSettings}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-300/50 text-sm font-bold text-amber-100"
        >
          <Settings2 className="h-4 w-4" /> Set up reader
        </button>
      </div>
      <p className="mt-2 text-[11px] text-amber-100/60">
        You can still take cash while the reader is offline.
      </p>
    </div>
  );
}

/** Small pill used next to each reader in lists. */
export function ReaderStatusPill({ status }: { status: string }) {
  const online = isReaderOnline(status);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
        online ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"
      }`}
    >
      {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {readerStatusLabel(status)}
    </span>
  );
}
