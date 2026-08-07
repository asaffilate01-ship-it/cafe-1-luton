import { useEffect, useState } from "react";
import { readDisplayPresence, subscribeToDisplayPresence } from "@/lib/customer-display";

const DISPLAY_STALE_MS = 12_000;

/** Reports whether the second screen has sent a recent heartbeat. */
export function useCustomerDisplayStatus() {
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setLastSeenAt(readDisplayPresence());
    const unsubscribe = subscribeToDisplayPresence(setLastSeenAt);
    const interval = window.setInterval(() => setNow(Date.now()), 3_000);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, []);

  return {
    connected: lastSeenAt !== null && now - lastSeenAt < DISPLAY_STALE_MS,
    lastSeenAt,
  };
}
