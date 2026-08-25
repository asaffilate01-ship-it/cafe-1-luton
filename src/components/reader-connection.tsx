import { Bluetooth, CheckCircle2, Loader2, RefreshCw, Settings2, Smartphone, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isReaderOnline, readerStatusLabel } from "@/lib/reader-status";

export type ReaderInfo = { id: string; name: string; status: string };

/** Network-terminal setup steps for an EVO terminal. */
export function WifiSetupSteps() {
  return (
    <ol className="mt-2 space-y-1.5 text-xs text-white/60">
      <li>
        <span className="font-bold text-white/80">1.</span> On the EVO terminal, open the connection
        settings and select Wi-Fi.
      </li>
      <li>
        <span className="font-bold text-white/80">2.</span> Connect the terminal to Wi-Fi and wait for
        the status bar icon to show connected.
      </li>
      <li>
        <span className="font-bold text-white/80">3.</span> Open the EVO payment app and confirm the
        terminal is signed in to the correct Café 1 merchant account.
      </li>
      <li>
        <span className="font-bold text-white/80">4.</span> Run a low-value test transaction before
        using the terminal for live orders.
      </li>
    </ol>
  );
}

type NativeEvoBridge = {
  listBondedDevices: () => string;
  connectDevice: (address: string) => string;
  disconnect: () => void;
  status: () => string;
};

type NativeEvoWindow = Window & { Cafe1EvoTerminal?: NativeEvoBridge };

type BondedReader = { name: string; address: string };

/** Pairs the EVO Mobile/3500 with Edge when it is exposed as a BLE device. */
export function EvoBluetoothConnection() {
  const [device, setDevice] = useState<string>(() =>
    typeof window === "undefined" ? "" : (window.localStorage.getItem("cafe1-evo-reader") ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [bonded, setBonded] = useState<BondedReader[]>([]);
  const native = typeof window === "undefined" ? undefined : (window as NativeEvoWindow).Cafe1EvoTerminal;

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; name?: string; error?: string }>).detail;
      if (detail?.connected && detail.name) {
        window.localStorage.setItem("cafe1-evo-reader", detail.name);
        setDevice(detail.name);
        setBusy(false);
        toast.success(`${detail.name} connected`);
      } else if (detail?.error) {
        setBusy(false);
        toast.error(detail.error);
      }
    };
    window.addEventListener("cafe1:evo-terminal", onStatus);
    return () => window.removeEventListener("cafe1:evo-terminal", onStatus);
  }, []);

  async function pair() {
    if (native) {
      try {
        const devices = JSON.parse(native.listBondedDevices()) as BondedReader[];
        setBonded(devices);
        if (!devices.length) {
          toast.error("Pair the EVO Mobile/3500 in Android Bluetooth settings first");
          return;
        }
        if (devices.length === 1) connectNative(devices[0]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not read paired terminals");
      }
      return;
    }
    toast.error("Install the Café 1 iMin APK to connect the EVO terminal by Bluetooth");
  }

  function connectNative(reader: BondedReader) {
    if (!native) return;
    setBusy(true);
    const result = JSON.parse(native.connectDevice(reader.address)) as {
      accepted?: boolean;
      error?: string;
    };
    if (!result.accepted) {
      setBusy(false);
      toast.error(result.error ?? "The terminal connection was not accepted");
    }
  }

  function forget() {
    native?.disconnect();
    window.localStorage.removeItem("cafe1-evo-reader");
    setDevice("");
    window.dispatchEvent(new CustomEvent("cafe1-evo-reader-change", { detail: "" }));
  }

  return (
    <div className="mt-3 rounded-xl border border-sky-300/30 bg-sky-400/10 p-3">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-sky-100">
        <Bluetooth className="h-4 w-4" /> EVO Mobile/3500 Bluetooth
      </p>
      {device ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-400/15 px-3 py-2 text-xs text-emerald-100">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Connected: {device}</span>
          <button type="button" onClick={forget} className="font-bold underline">
            Forget
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void pair()}
            disabled={busy}
            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-300 text-sm font-black text-slate-950 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bluetooth className="h-4 w-4" />}
            {busy
              ? "Connecting…"
              : native
                ? "Find paired EVO terminal"
                : "Bluetooth requires iMin APK"}
          </button>
          {bonded.length > 1 && (
            <div className="mt-2 grid gap-1.5">
              {bonded.map((reader) => (
                <button
                  key={reader.address}
                  type="button"
                  onClick={() => connectNative(reader)}
                  className="rounded-lg border border-sky-200/30 px-3 py-2 text-left text-xs font-bold text-sky-50"
                >
                  {reader.name} · {reader.address}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <p className="mt-2 text-[11px] text-sky-100/70">
        In the iMin APK, pair the terminal in Android settings first, then connect it here. A normal
        browser cannot run EVO&apos;s certified Bluetooth payment protocol. Complete payments on the
        EVO terminal and retain its receipt reference until EVO integration credentials are added.
      </p>
    </div>
  );
}

/** Guidance for the EVO Bluetooth reader. */
export function BluetoothSetupSteps() {
  return (
    <div className="mt-2 rounded-xl border border-sky-300/25 bg-sky-400/10 p-3 text-xs text-sky-100/80">
      <p className="flex items-center gap-2 font-bold text-sky-100">
        <Smartphone className="h-4 w-4" /> EVO Mobile/3500
      </p>
      <p className="mt-1.5">
        On the terminal, open Menu → Settings → Bluetooth, turn Bluetooth on and select pairing
        mode. Keep the terminal close to the till while connecting.
      </p>
      <p className="mt-1.5">
        Bluetooth links the device to the till. Card authorisation still happens securely inside the
        EVO payment application on the terminal.
      </p>
      <EvoBluetoothConnection />
    </div>
  );
}

/** Tabbed guide so staff can link an EVO terminal over Bluetooth or Wi-Fi. */
export function ReaderLinkGuide({ defaultMode = "bluetooth" }: { defaultMode?: "wifi" | "bluetooth" }) {
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
 * Shown on the card-payment screen whenever the selected reader is unavailable.
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
    ? "Cafe 1 cannot reach the card terminal right now."
    : !readers.length
      ? "No EVO Mobile/3500 is connected to this till yet."
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
