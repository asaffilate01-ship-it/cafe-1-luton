import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public checkout helpers. The underlying SECURITY DEFINER routines are no
 * longer executable by anon/authenticated roles — they can only be reached
 * through these validated server functions.
 */
export const getEmailDiscount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().email().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { checkThrottle, recordAttempt, requestIdentity } = await import("./rate-limit.server");
    const ident = requestIdentity();
    const gate = await checkThrottle("promo", ident);
    if (!gate.allowed) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.rpc("get_customer_discount", {
      _email: data.email.trim().toLowerCase(),
    });
    const row = (rows ?? [])[0];
    await recordAttempt("promo", ident, Boolean(row));
    return row ? { percent: row.percent, label: row.label ?? null } : null;
  });

export const validatePromo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().min(2).max(40),
        subtotal_cents: z.number().int().min(0).max(1_000_000),
        order_type: z.enum(["delivery", "collection", "dine_in"]),
        email: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { checkThrottle, recordAttempt, requestIdentity } = await import("./rate-limit.server");
    const ident = requestIdentity();
    const gate = await checkThrottle("promo", ident);
    if (!gate.allowed) return { valid: false as const, message: gate.message ?? "Too many attempts." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("validate_promo_code", {
      _code: data.code.trim().toUpperCase(),
      _subtotal_cents: data.subtotal_cents,
      _order_type: data.order_type,
      _email: data.email?.trim() || undefined,
    });
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0];
    await recordAttempt("promo", ident, !!row?.valid);
    if (!row || !row.valid) {
      return { valid: false as const, message: row?.message ?? "That code isn't valid." };
    }
    return {
      valid: true as const,
      code: row.code,
      discount_cents: row.discount_cents ?? 0,
      discount_type: row.discount_type,
      message: row.message,
    };
  });