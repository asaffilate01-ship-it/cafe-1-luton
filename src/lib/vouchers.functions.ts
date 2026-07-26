import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const lookupVoucher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().min(1).max(40) }).parse(d),
  )
  .handler(async ({ data }) => {
    const code = (data.code ?? "").trim();
    if (!code) return { found: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("get_voucher_balance_by_code", {
      _code: code,
    });
    if (error) {
      console.error("[vouchers] lookup failed", error);
      return { found: false as const };
    }
    const row = (rows ?? [])[0];
    if (!row) return { found: false as const };
    return {
      found: true as const,
      holder_name: (row.holder_name as string | null) ?? "",
      code: row.code as string,
      allocated_cents: row.allocated_cents as number,
      used_cents: row.used_cents as number,
      remaining_cents: row.remaining_cents as number,
    };
  });