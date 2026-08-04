import { Bluetooth, Loader2, RefreshCw, Settings2, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";

type NavigatorWithBluetooth = Navigator & {
  bluetooth?: {
    requestDevice: (options: {
      acceptAllDevices?: boolean;
      optionalServices?: string[];
    }) => Promise<{ name?: string | null }>;
  };
};

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

/** The Bluetooth steps staff follow when the café Wi-Fi is down or the Solo is used away from the counter. */
export function BluetoothSetupSteps() {
  return (
    <ol className="mt-2 space-y-1.5 text-xs text-white/60">
      <li>
        <span className="font-bold text-white/80">1.</span> On the Solo: swipe down → Settings →
        Connections → Bluetooth, and turn Bluetooth on so it is discoverable.
      </li>
      <li>
        <span className="font-bold text-white/80">2.</span> On this till device, turn Bluetooth on
        and press “Pair over Bluetooth” below, then choose the Solo in the list.
      </li>
      <li>
        <span className="font-bold text-white/80">3.</span> Confirm the matching code on both
        screens.
      </li>
      <li>
        <span className="font-bold text-white/80">4.</span> Back on the Solo: Settings →
        Connections → Pair device, then enter that code below to finish linking it to Cafe 1.
      </li>
    </ol>
  );
}

/** Bluetooth pairing button — uses the device chooser when the browser supports it. */
export function BluetoothPairButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function pair() {
    const bt = (navigator as NavigatorWithBluetooth).bluetooth;
    if (!bt) {
      setResult(
        "This browser can't open the Bluetooth chooser — pair the Solo from the till device's own Bluetooth settings, then enter the pairing code below.",
      );
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: [] });
      setResult(
        `Bluetooth link started with ${device.name || "the selected device"}. Now enter the Solo's pairing code below.`,
      );
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Bluetooth pairing was cancelled.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => void pair()}
        disabled={busy}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-sky-300/50 text-sm font-bold text-sky-100 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bluetooth className="h-4 w-4" />}
        Pair over Bluetooth
      </button>
      {result && <p className="mt-2 text-[11px] text-white/60">{result}</p>}
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
      {mode === "wifi" ? (
        <WifiSetupSteps />
      ) : (
        <>
          <BluetoothSetupSteps />
          <BluetoothPairButton />
        </>
      )}
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
