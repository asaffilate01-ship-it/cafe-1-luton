import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getPushPublicKey,
  removePushSubscription,
  savePushSubscription,
} from "@/lib/push.functions";

function urlBase64ToUint8Array(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const toB64 = (buf: ArrayBuffer | null) =>
  buf
    ? btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
    : "";

export type PushTopic = "orders" | "offers" | "kitchen";

/**
 * Browser/mobile push alerts for the signed-in user.
 * `topics` decides what this device is signed up for: order progress, offers,
 * or kitchen tickets (staff only, optionally scoped to one branch).
 */
export function useWebPush(options?: { topics?: PushTopic[]; siteId?: string | null }) {
  const topics = options?.topics ?? (["orders"] as PushTopic[]);
  const siteId = options?.siteId ?? null;
  const fetchKey = useServerFn(getPushPublicKey);
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(removePushSubscription);
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => setEnabled(false));
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return { ok: false, reason: "Notifications were blocked." };
      const { key } = await fetchKey();
      if (!key) return { ok: false, reason: "Notifications aren't configured yet." };
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
        }));
      const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
      await save({
        data: {
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? toB64(sub.getKey("p256dh")),
          auth: json.keys?.auth ?? toB64(sub.getKey("auth")),
          user_agent: navigator.userAgent.slice(0, 300),
          topics,
          site_id: siteId,
        },
      });
      setEnabled(true);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "Couldn't turn on alerts." };
    } finally {
      setBusy(false);
    }
  }, [fetchKey, save, topics, siteId]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await remove({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  }, [remove]);

  return { supported, enabled, busy, enable, disable };
}
