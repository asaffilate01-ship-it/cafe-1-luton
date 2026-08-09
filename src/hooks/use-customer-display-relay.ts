import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DISPLAY_REMOTE_MESSAGE_EVENT,
  readCachedDisplayMessage,
  type DisplayMessage,
} from "@/lib/customer-display";
import {
  buildDisplayRelayUrl,
  clearDisplayRelayToken,
  consumeDisplayRelayTokenFromHash,
  displayRelayTopic,
  generateDisplayRelayToken,
  isRemoteDisplayMessage,
  readDisplayRelayToken,
  saveDisplayRelayToken,
  signDisplayRelayPayload,
  verifyDisplayRelayEnvelope,
  type RemoteDisplayMessage,
} from "@/lib/customer-display-relay";

const PEER_STALE_MS = 12_000;

export type DisplayRelayChannelStatus = "disabled" | "connecting" | "connected" | "error";

export type CustomerDisplayRelay = {
  configured: boolean;
  connected: boolean;
  channelStatus: DisplayRelayChannelStatus;
  displayUrl: string;
  lastSeenAt: number | null;
  rotatePairing: () => string;
  forgetPairing: () => void;
};

/**
 * Signed Supabase Realtime relay for a display on another browser or Wi-Fi
 * device. The local BroadcastChannel path remains active as a fast fallback.
 */
export function useCustomerDisplayRelay({
  role,
  onMessage,
}: {
  role: "till" | "display";
  onMessage?: (message: RemoteDisplayMessage) => void;
}): CustomerDisplayRelay {
  const [token, setToken] = useState("");
  const [channelStatus, setChannelStatus] = useState<DisplayRelayChannelStatus>("disabled");
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const fromHash = consumeDisplayRelayTokenFromHash();
    let current = fromHash || readDisplayRelayToken();
    if (!current && role === "till") {
      current = generateDisplayRelayToken();
      saveDisplayRelayToken(current);
    }
    setToken(current);
  }, [role]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 3_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!token) {
      setChannelStatus("disabled");
      setLastSeenAt(null);
      return;
    }

    let disposed = false;
    let ready = false;
    let presenceTimer: number | null = null;
    const seenNonces = new Set<string>();
    const cleanupRef = { current: null as (() => void) | null };
    setChannelStatus("connecting");

    void displayRelayTopic(token)
      .then((topic) => {
        if (disposed) return;
        const channel = supabase.channel(topic, {
          config: { broadcast: { ack: true, self: false } },
        });

        const rememberNonce = (nonce: string) => {
          seenNonces.add(nonce);
          if (seenNonces.size > 100) {
            const oldest = seenNonces.values().next().value;
            if (oldest) seenNonces.delete(oldest);
          }
        };

        const send = async (
          input: { kind: "state"; message: RemoteDisplayMessage } | { kind: "presence" },
        ) => {
          if (!ready || disposed) return;
          const envelope = await signDisplayRelayPayload(token, input);
          if (disposed) return;
          await channel.send({ type: "broadcast", event: "relay", payload: envelope });
        };

        const sendCachedState = () => {
          const cached = readCachedDisplayMessage();
          if (cached) void send({ kind: "state", message: cached });
        };

        const handleRelay = async ({ payload: value }: { payload?: unknown }) => {
          const payload = await verifyDisplayRelayEnvelope(token, value);
          if (!payload || seenNonces.has(payload.nonce) || disposed) return;
          rememberNonce(payload.nonce);
          if (role === "till" && payload.kind === "presence") {
            setLastSeenAt(Date.now());
            sendCachedState();
          } else if (role === "display" && payload.kind === "state") {
            onMessageRef.current?.(payload.message);
          }
        };

        channel
          .on(
            "broadcast",
            { event: "relay" },
            (event) => void handleRelay(event as unknown as { payload?: unknown }),
          )
          .subscribe((status) => {
            if (disposed) return;
            if (status === "SUBSCRIBED") {
              ready = true;
              setChannelStatus("connected");
              if (role === "display") {
                void send({ kind: "presence" });
                presenceTimer = window.setInterval(() => void send({ kind: "presence" }), 5_000);
              } else {
                sendCachedState();
              }
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              ready = false;
              setChannelStatus("error");
            } else if (status === "CLOSED") {
              ready = false;
              setChannelStatus("connecting");
            }
          });

        const onLocalState = (event: Event) => {
          if (role !== "till") return;
          const message = (event as CustomEvent<DisplayMessage>).detail;
          if (isRemoteDisplayMessage(message)) void send({ kind: "state", message });
        };
        window.addEventListener(DISPLAY_REMOTE_MESSAGE_EVENT, onLocalState);

        const cleanup = () => {
          ready = false;
          if (presenceTimer !== null) window.clearInterval(presenceTimer);
          window.removeEventListener(DISPLAY_REMOTE_MESSAGE_EVENT, onLocalState);
          void supabase.removeChannel(channel);
        };
        if (disposed) cleanup();
        else cleanupRef.current = cleanup;
      })
      .catch(() => {
        if (!disposed) setChannelStatus("error");
      });
    return () => {
      disposed = true;
      cleanupRef.current?.();
    };
  }, [role, token]);

  const rotatePairing = useCallback(() => {
    const next = generateDisplayRelayToken();
    saveDisplayRelayToken(next);
    setLastSeenAt(null);
    setToken(next);
    return next;
  }, []);

  const forgetPairing = useCallback(() => {
    clearDisplayRelayToken();
    setLastSeenAt(null);
    setToken("");
  }, []);

  const displayUrl = useMemo(() => (token ? buildDisplayRelayUrl(token) : ""), [token]);
  const connected =
    role === "display"
      ? channelStatus === "connected"
      : lastSeenAt !== null && now - lastSeenAt < PEER_STALE_MS;

  return {
    configured: Boolean(token),
    connected,
    channelStatus,
    displayUrl,
    lastSeenAt,
    rotatePairing,
    forgetPairing,
  };
}
