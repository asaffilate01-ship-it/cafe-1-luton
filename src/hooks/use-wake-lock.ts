import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "cafe1_kds_wakelock";

/** Keeps the device screen awake (Screen Wake Lock API). Re-acquires after tab switches. */
export function useWakeLock() {
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const ref = useRef<any>(null);

  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabled(window.localStorage.getItem(KEY) === "1");
  }, []);

  const release = useCallback(async () => {
    try { await ref.current?.release?.(); } catch { /* ignore */ }
    ref.current = null;
    setActive(false);
  }, []);

  const acquire = useCallback(async () => {
    if (!supported || document.visibilityState !== "visible") return;
    try {
      ref.current = await (navigator as any).wakeLock.request("screen");
      ref.current.addEventListener?.("release", () => setActive(false));
      setActive(true);
    } catch {
      setActive(false);
    }
  }, [supported]);

  useEffect(() => {
    if (!enabled) { release(); return; }
    acquire();
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); release(); };
  }, [enabled, acquire, release]);

  const toggle = useCallback(() => {
    setEnabled((e) => {
      const next = !e;
      try { window.localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { supported, enabled, active, toggle };
}
