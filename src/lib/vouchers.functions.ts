import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const STATUS_MESSAGE: Record<string, string> = {
  inactive: "This voucher code has been deactivated. Please speak to the Jury Officer.",
  not_started: "This voucher code isn't active yet — it starts on your first day of service.",
  expired:
    "This voucher code has expired. The Jury Officer can arrange an extension for longer trials.",
  non_sitting_day:
    "The daily allowance only applies on court sitting days (Monday to Friday, excluding bank holidays).",
  locked:
    "This voucher is temporarily locked after several incorrect PIN attempts. Please wait 15 minutes or speak to the Jury Officer.",
};

export type VoucherLookup = Awaited<ReturnType<typeof lookupVoucher>>;

/** Anonymous balance check using the code and separately issued six-digit PIN. */
export const lookupVoucher = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        code: z.string().min(1).max(40),
        pin: z.string().regex(/^\d{6}$/, "Enter the six-digit PIN"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const code = (data.code ?? "").trim();
    if (!code) return { found: false as const };
    const { checkThrottle, recordAttempt, requestIdentity } = await import("./rate-limit.server");
    const ident = requestIdentity();
    const gate = await checkThrottle("voucher", ident);
    if (!gate.allowed)
      return { found: false as const, throttled: true as const, message: gate.message };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { callOperationsRpc } = await import("./ops-rpc");
    let rows: Array<{
      holder_id: string;
      holder_name: string | null;
      code: string;
      allocated_cents: number;
      used_cents: number;
      remaining_cents: number;
      valid_from: string;
      valid_until: string | null;
      opted_in: boolean;
      jury_room: string | null;
      attendance_required: boolean;
      attendance_verified: boolean;
      status: string;
    }>;
    try {
      rows = await callOperationsRpc(supabaseAdmin, "verify_juror_voucher_credentials", {
        _code: code,
        _pin: data.pin,
      });
    } catch (error) {
      console.error("[vouchers] lookup failed", error);
      await recordAttempt("voucher", ident, false);
      return { found: false as const };
    }
    const row = rows[0];
    await recordAttempt("voucher", ident, !!row);
    if (!row) return { found: false as const };
    return {
      found: true as const,
      holder_name: row.holder_name ?? "",
      code: row.code,
      allocated_cents: row.allocated_cents,
      used_cents: row.used_cents,
      remaining_cents: row.remaining_cents,
      valid_from: row.valid_from,
      valid_until: row.valid_until,
      opted_in: row.opted_in,
      jury_room: row.jury_room,
      attendance_required: row.attendance_required,
      attendance_verified: row.attendance_verified,
      status: row.status,
      usable: row.status === "ok",
      message: STATUS_MESSAGE[row.status] ?? null,
    };
  });

/**
 * Records a juror's decision to join the scheme. Triggered by scanning the QR
 * code at the till, on the customer screen, or in the jury room.
 */
export const optInVoucher = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        code: z.string().min(1).max(40),
        pin: z.string().regex(/^\d{6}$/),
        source: z.enum(["till", "display", "online", "jury_room"]).default("online"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const code = data.code.trim();
    const { checkThrottle, recordAttempt, requestIdentity } = await import("./rate-limit.server");
    const ident = requestIdentity();
    const gate = await checkThrottle("voucher", ident);
    if (!gate.allowed) return { ok: false as const, message: gate.message, already: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { callOperationsRpc } = await import("./ops-rpc");
    let rows: Array<{ ok: boolean; message: string; already: boolean }>;
    try {
      rows = await callOperationsRpc(supabaseAdmin, "opt_in_voucher_secure", {
        _code: code,
        _pin: data.pin,
        _source: data.source,
      });
    } catch (error) {
      console.error("[vouchers] opt-in failed", error);
      await recordAttempt("voucher", ident, false);
      return {
        ok: false as const,
        message: "Could not record that opt-in. Please try again.",
        already: false,
      };
    }
    const row = rows[0];
    await recordAttempt("voucher", ident, !!row?.ok);
    return {
      ok: !!row?.ok,
      message: row?.message ?? "Code not recognised",
      already: !!row?.already,
    };
  });

/**
 * HMCTS Juror ID opt-in. The juror keys in the Juror ID they were issued by
 * the court; the system generates the six-digit PIN, returns it exactly once
 * for the juror to write down, and keeps only a hash from that point on.
 */
export const optInWithJurorId = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        code: z.string().trim().min(3).max(40),
        source: z.enum(["till", "display", "online", "jury_room"]).default("online"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { checkThrottle, recordAttempt, requestIdentity } = await import("./rate-limit.server");
    const ident = requestIdentity();
    const gate = await checkThrottle("voucher", ident);
    if (!gate.allowed)
      return { ok: false as const, message: gate.message, pin: null, already: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { callOperationsRpc } = await import("./ops-rpc");
    let rows: Array<{
      ok: boolean;
      message: string;
      pin: string | null;
      already: boolean;
      valid_until: string | null;
    }>;
    try {
      rows = await callOperationsRpc(supabaseAdmin, "juror_opt_in_with_id", {
        _code: data.code,
        _source: data.source,
      });
    } catch (error) {
      console.error("[vouchers] juror id opt-in failed", error);
      await recordAttempt("voucher", ident, false);
      return {
        ok: false as const,
        message: "Could not complete that opt-in. Please try again.",
        pin: null,
        already: false,
      };
    }
    const row = rows[0];
    await recordAttempt("voucher", ident, !!row?.ok);
    return {
      ok: !!row?.ok,
      message: row?.message ?? "That Juror ID is not recognised",
      pin: row?.pin ?? null,
      already: !!row?.already,
      valid_until: row?.valid_until ?? null,
    };
  });
