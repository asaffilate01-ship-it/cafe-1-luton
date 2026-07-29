import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Throttling for public code-guessing endpoints (voucher / promo lookups).
 * Workers are stateless, so attempts are counted in the database.
 */
export type ThrottleKind = "voucher" | "promo";

const LIMITS: Record<ThrottleKind, { window_s: number; max: number; lockout_s: number; lockout_after: number }> = {
  // per identity: 8 tries a minute, and 20 failures in 15 min = 15 min lockout
  voucher: { window_s: 60, max: 8, lockout_s: 900, lockout_after: 20 },
  promo: { window_s: 60, max: 10, lockout_s: 900, lockout_after: 25 },
};

export function requestIdentity(): string {
  const raw =
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0] ||
    getRequestHeader("x-real-ip") ||
    "unknown";
  return raw.trim().slice(0, 64) || "unknown";
}

export type ThrottleResult = { allowed: boolean; message?: string };

export async function checkThrottle(kind: ThrottleKind, ident: string): Promise<ThrottleResult> {
  const cfg = LIMITS[kind];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - cfg.window_s * 1000).toISOString();
    const lockSince = new Date(Date.now() - cfg.lockout_s * 1000).toISOString();

    const [{ count: recent }, { count: failures }] = await Promise.all([
      supabaseAdmin
        .from("code_attempts")
        .select("id", { count: "exact", head: true })
        .eq("kind", kind)
        .eq("ident", ident)
        .gte("created_at", since),
      supabaseAdmin
        .from("code_attempts")
        .select("id", { count: "exact", head: true })
        .eq("kind", kind)
        .eq("ident", ident)
        .eq("ok", false)
        .gte("created_at", lockSince),
    ]);

    if ((failures ?? 0) >= cfg.lockout_after) {
      return { allowed: false, message: "Too many incorrect codes. Please try again later or ask a member of staff." };
    }
    if ((recent ?? 0) >= cfg.max) {
      return { allowed: false, message: "Too many attempts — please wait a minute and try again." };
    }
    return { allowed: true };
  } catch (e) {
    // Never block a genuine customer if the counter is unavailable.
    console.error("[throttle] check failed", e);
    return { allowed: true };
  }
}

export async function recordAttempt(kind: ThrottleKind, ident: string, ok: boolean) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("code_attempts").insert({ kind, ident, ok });
  } catch (e) {
    console.error("[throttle] record failed", e);
  }
}