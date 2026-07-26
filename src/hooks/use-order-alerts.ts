import { useEffect, useRef, useState } from "react";

// Simple WebAudio beep — no asset required. Two-tone chime for new events.
function playChime() {
  try {
    type Ctor = typeof AudioContext;
    const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
    const Ctx = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const tones = [880, 1320];
    tones.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.35, now + i * 0.22 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * 0.22);
      o.stop(now + i * 0.22 + 0.4);
    });
  } catch { /* noop */ }
}

function notify(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icon-512.png", tag: `cafe1-${Date.now()}` });
  } catch { /* noop */ }
  try {
    if ("vibrate" in navigator) navigator.vibrate?.([200, 80, 200]);
  } catch { /* noop */ }
}

/**
 * Fires an audible chime + browser notification when `count` increases.
 * Suppresses the very first evaluation (initial load).
 */
export function useAlertOnIncrease(count: number, title: string, body: string) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (last.current === null) { last.current = count; return; }
    if (count > last.current) {
      playChime();
      notify(title, body);
    }
    last.current = count;
  }, [count, title, body]);
}

export function useNotificationPermission() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  async function request() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
  }
  return { perm, request };
}