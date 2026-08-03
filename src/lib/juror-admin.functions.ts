import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireManagerMfa } from "./elevated-auth.server";
import { callOperationsRpc } from "./ops-rpc";

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function requireVoucherStaff(client: unknown, userId: string) {
  const [admin, staff] = await Promise.all([
    callOperationsRpc<boolean>(client, "has_role", { _user_id: userId, _role: "admin" }),
    callOperationsRpc<boolean>(client, "has_role", { _user_id: userId, _role: "staff" }),
  ]);
  if (!admin && !staff) throw new Error("Voucher staff access is required");
}

export type IssuedJurorCredential = {
  code: string;
  pin: string;
  valid_from: string;
  valid_until: string;
};

/** Generates code/PIN pairs inside Postgres. Plain PINs are returned once. */
export const issueJurorBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        batch: z.string().trim().min(2).max(120),
        count: z.number().int().min(1).max(200).default(100),
        valid_from: IsoDate,
        service_days: z.number().int().min(1).max(60).default(10),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    requireManagerMfa(context.claims);
    return callOperationsRpc<IssuedJurorCredential[]>(context.supabase, "cafe1_issue_juror_batch", {
      _batch: data.batch,
      _count: data.count,
      _valid_from: data.valid_from,
      _service_days: data.service_days,
    });
  });

export const manageJurorVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        holder_id: z.string().uuid(),
        action: z.enum(["extend", "deactivate", "reactivate"]),
        working_days: z.number().int().min(0).max(60).default(0),
        reason: z.string().trim().min(4).max(300),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    requireManagerMfa(context.claims);
    return callOperationsRpc<{
      id: string;
      code: string;
      active: boolean;
      valid_until: string;
    }>(context.supabase, "cafe1_manage_juror_voucher", {
      _holder_id: data.holder_id,
      _action: data.action,
      _working_days: data.working_days,
      _reason: data.reason,
    });
  });

export const setJurorDailyAllowance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        holder_id: z.string().uuid(),
        for_date: IsoDate,
        amount_cents: z.union([z.literal(571), z.literal(1217)]),
        reason: z.string().trim().min(4).max(300),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    requireManagerMfa(context.claims);
    return callOperationsRpc<{
      holder_id: string;
      for_date: string;
      amount_cents: number;
    }>(context.supabase, "cafe1_set_juror_daily_allowance", {
      _holder_id: data.holder_id,
      _for_date: data.for_date,
      _amount_cents: data.amount_cents,
      _reason: data.reason,
    });
  });

export type JurorClaimRow = {
  redemption_id: string;
  holder_id: string;
  for_date: string;
  amount_cents: number;
  redeemed_at: string;
  order_id: string;
  order_number: number;
  voucher_code: string;
  batch: string | null;
};

/** Claim rows exclude unpaid, cancelled and refunded orders. */
export const listJurorClaimRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({ from: IsoDate, to: IsoDate })
      .refine((v) => v.from <= v.to, {
        message: "The claim start must be before its end",
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    await requireVoucherStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return callOperationsRpc<JurorClaimRow[]>(supabaseAdmin, "get_juror_claim_rows", {
      _from: data.from,
      _to: data.to,
    });
  });
