import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConnectionState = {
  /** The browser reports no network at all. */
  offline: boolean;
  /** We have a network but cannot reach the Cafe1 backend. */
  backendDown: boolean;
  /** When we last successfully reached the backend. */
  lastOkAt: number | null;
};

/**
 * Watches whether this kitchen display can still reach the internet and the
 * Cafe1 backend, so staff know when tickets may be stale.
 */
export function useConnectionStatus(intervalMs = 15_000): ConnectionState {
  const [offline, setOffline] = useState(false);
  const [backendDown, setBackendDown] = useState(false);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let failures = 0;
    async function ping() {
      try {
        const { error } = await supabase.from("business_settings").select("id").limit(1);
        if (cancelled) return;
        if (error) {
          failures += 1;
          if (failures >= 2) setBackendDown(true);
        } else {
          failures = 0;
          setBackendDown(false);
          setLastOkAt(Date.now());
        }
      } catch {
        if (cancelled) return;
        failures += 1;
        if (failures >= 2) setBackendDown(true);
      }
    }
    void ping();
    const t = setInterval(() => void ping(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [intervalMs]);

  return { offline, backendDown, lastOkAt };
}
