import { useEffect, useRef, useState } from "react";

// Simple WebAudio beep — no asset required. Two-tone chime for new events.
export function playChime() {
  try {
    type Ctor = typeof AudioContext;
    const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
    const Ctx = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    void ctx.resume?.();
    const now = ctx.currentTime;
    // Master bus with soft clipping so it's loud without distorting
    const master = ctx.createGain();
    master.gain.value = 1;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    // Repeat the two-tone chime 3× for a louder, more attention-grabbing alert
    const tones = [880, 1320, 880, 1320, 880, 1320];
    tones.forEach((freq, i) => {
      const t = now + i * 0.22;
      // Sine + square blend = much more perceived loudness
      (["sine", "square"] as OscillatorType[]).forEach((type) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        const peak = type === "square" ? 0.35 : 0.9;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + 0.42);
      });
    });
    setTimeout(() => { try { ctx.close(); } catch { /* noop */ } }, 2500);
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
  // Start with a value that matches SSR to avoid hydration mismatches,
  // then sync to the real browser permission after mount.
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  useEffect(() => {
    if (typeof Notification === "undefined") setPerm("unsupported");
    else setPerm(Notification.permission);
  }, []);
  async function request() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
  }
  return { perm, request };
}