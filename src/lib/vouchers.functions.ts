import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Court voucher lookup for checkout. Matches an active voucher holder on
 * email OR phone number and returns today's remaining allowance.
 * Runs with service_role because the voucher tables and RPCs are staff-only.
 */
export const lookupVoucher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().max(255).optional(),
        phone: z.string().max(30).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const email = (data.email ?? "").trim();
    const phone = (data.phone ?? "").trim();
    if (!email && phone.replace(/\D/g, "").length < 7) {
      return { found: false as const };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("get_voucher_balance", {
      _email: email || null,
      _phone: phone || null,
    });
    if (error) {
      console.error("[vouchers] lookup failed", error);
      return { found: false as const };
    }
    const row = (rows ?? [])[0];
    if (!row) return { found: false as const };
    return {
      found: true as const,
      holder_name: row.holder_name as string,
      allocated_cents: row.allocated_cents as number,
      used_cents: row.used_cents as number,
      remaining_cents: row.remaining_cents as number,
    };
  });