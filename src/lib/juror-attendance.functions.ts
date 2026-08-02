import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callOperationsRpc } from "./ops-rpc";

function encodeToken(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(token).digest("hex");
}

export const createJurorAttendanceChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ room: z.string().trim().min(2).max(100) }).parse(value))
  .handler(async ({ data, context }) => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = encodeToken(bytes);
    const challenge = await callOperationsRpc<{ id: string; room: string; expires_at: string }>(
      context.supabase,
      "cafe1_create_juror_challenge",
      { _room: data.room, _token_hash: await hashToken(token) },
    );
    return { ...challenge, token };
  });

export const verifyJurorAttendance = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({
        token: z.string().regex(/^[a-f0-9]{48}$/),
        voucher_code: z.string().trim().min(4).max(40),
      })
      .parse(value),
  )
  .handler(async ({ data }) => {
    const { checkThrottle, recordAttempt, requestIdentity } = await import("./rate-limit.server");
    const identity = requestIdentity();
    const gate = await checkThrottle("voucher", identity);
    if (!gate.allowed) return { ok: false as const, message: gate.message ?? "Try again later." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await callOperationsRpc<{
      ok: boolean;
      message?: string;
      room?: string;
      verified_until?: string;
    }>(supabaseAdmin, "cafe1_consume_juror_challenge", {
      _token_hash: await hashToken(data.token),
      _voucher_code: data.voucher_code,
    });
    await recordAttempt("voucher", identity, result.ok);
    return result;
  });
