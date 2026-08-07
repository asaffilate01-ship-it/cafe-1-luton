import { Bluetooth, Loader2, RefreshCw, Settings2, Smartphone, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { isReaderOnline, readerStatusLabel } from "@/lib/reader-status";

export type ReaderInfo = { id: string; name: string; status: string };

/** The official SumUp Cloud API pairing steps staff follow on the Solo itself. */
export function WifiSetupSteps() {
  return (
    <ol className="mt-2 space-y-1.5 text-xs text-white/60">
      <li>
        <span className="font-bold text-white/80">1.</span> On the Solo: Settings → About → Log out
        (the reader must be signed out before it can pair to the Cloud API).
      </li>
      <li>
        <span className="font-bold text-white/80">2.</span> Connect the Solo to Wi-Fi and wait for
        the status bar icon to show connected.
      </li>
      <li>
        <span className="font-bold text-white/80">3.</span> Open Connections → API → Connect. An 8–9
        character pairing code appears on the Solo.
      </li>
      <li>
        <span className="font-bold text-white/80">4.</span> Enter that code below within 5 minutes,
        then press Retry — the reader should show Online and is ready to take payments.
      </li>
    </ol>
  );
}

/** Accurate guidance for Bluetooth readers: the web till cannot perform certified payments itself. */
export function BluetoothSetupSteps() {
  return (
    <div className="mt-2 rounded-xl border border-sky-300/25 bg-sky-400/10 p-3 text-xs text-sky-100/80">
      <p className="flex items-center gap-2 font-bold text-sky-100">
        <Smartphone className="h-4 w-4" /> Native app required
      </p>
      <p className="mt-1.5">
        Bluetooth payment readers must be connected through Cafe 1&apos;s signed Android/iOS
        companion app and the official payment-provider SDK. Browser Bluetooth is not used for card
        payments because selecting a device alone cannot authorise or complete a transaction.
      </p>
      <p className="mt-1.5">
        For the SumUp Solo, use Cloud pairing over Wi-Fi or mobile data in the Wi-Fi tab.
      </p>
    </div>
  );
}

/** Tabbed guide so staff can link the Solo over Wi-Fi or Bluetooth. */
export function ReaderLinkGuide({ defaultMode = "wifi" }: { defaultMode?: "wifi" | "bluetooth" }) {
  const [mode, setMode] = useState<"wifi" | "bluetooth">(defaultMode);
  return (
    <div>
      <div className="flex gap-1.5">
        {(
          [
            ["wifi", "Wi-Fi", Wifi],
            ["bluetooth", "Bluetooth", Bluetooth],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide ${
              mode === value
                ? "bg-white/90 text-neutral-900"
                : "border border-white/15 text-white/70 hover:border-white/40"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>
      {mode === "wifi" ? <WifiSetupSteps /> : <BluetoothSetupSteps />}
    </div>
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
      <ReaderLinkGuide />
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
