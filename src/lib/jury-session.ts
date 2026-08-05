import { useSyncExternalStore } from "react";

/**
 * Verified juror session for the gated Jury Only menu.
 * The PIN is NEVER stored — only the code and the balance shown on screen.
 * Held in sessionStorage so it dies with the tab (shared jury-room devices).
 */
export type JurySession = {
  code: string;
  remaining_cents: number;
  jury_room: string | null;
  verified_at: number;
} | null;

const KEY = "cafe1-jury-session";
/** Short lived — a juror re-keys the code and PIN on each visit. */
const TTL_MS = 45 * 60 * 1000;

const listeners = new Set<() => void>();
let cached: JurySession = null;
let hydrated = false;

function read(): JurySession {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NonNullable<JurySession>;
    if (!parsed?.verified_at || Date.now() - parsed.verified_at > TTL_MS) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const jurySession = {
  get(): JurySession {
    if (!hydrated && typeof window !== "undefined") {
      cached = read();
      hydrated = true;
    }
    return cached;
  },
  set(next: JurySession) {
    cached = next;
    hydrated = true;
    if (typeof window !== "undefined") {
      if (next) window.sessionStorage.setItem(KEY, JSON.stringify(next));
      else window.sessionStorage.removeItem(KEY);
    }
    listeners.forEach((l) => l());
  },
  clear() {
    this.set(null);
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useJurySession(): JurySession {
  return useSyncExternalStore(
    jurySession.subscribe.bind(jurySession),
    jurySession.get.bind(jurySession),
    () => null,
  );
}