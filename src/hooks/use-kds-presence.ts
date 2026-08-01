import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const KDS_PRESENCE_CHANNEL = "cafe1-kds-presence";

/** Called by the kitchen display so other terminals can see it is running. */
export function useKdsHeartbeat(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase.channel(KDS_PRESENCE_CHANNEL, {
      config: { presence: { key: crypto.randomUUID() } },
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") void ch.track({ at: Date.now() });
    });
    return () => { supabase.removeChannel(ch); };
  }, [enabled]);
}

/** Watches whether at least one kitchen display is currently open. */
export function useKdsOnline() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const ch = supabase.channel(KDS_PRESENCE_CHANNEL, {
      config: { presence: { key: crypto.randomUUID() } },
    });
    const sync = () => setCount(Object.keys(ch.presenceState()).length);
    ch.on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  return count;
}

/** Lightweight backend reachability check for the till status strip. */
export function useBackendStatus(intervalMs = 30_000) {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function ping() {
      const { error } = await supabase.from("business_settings").select("id").limit(1);
      if (!cancelled) setOk(!error);
    }
    void ping();
    const t = setInterval(() => void ping(), intervalMs);
    return () => { cancelled = true; clearInterval(t); };
  }, [intervalMs]);
  return ok;
}
