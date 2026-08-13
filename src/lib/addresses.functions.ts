import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AddressSchema = z.object({
  label: z.string().trim().min(1).max(40).default("Home"),
  company_name: z.string().trim().max(120).optional(),
  address_line1: z.string().trim().min(1).max(200),
  address_line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(80),
  postcode: z.string().trim().min(3).max(20),
  delivery_notes: z.string().trim().max(500).optional(),
  is_default: z.boolean().default(false),
});

export const listAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("customer_addresses")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => AddressSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.is_default) {
      await context.supabase
        .from("customer_addresses")
        .update({ is_default: false })
        .eq("user_id", context.userId);
    }
    const { data: row, error } = await context.supabase
      .from("customer_addresses")
      .insert({
        user_id: context.userId,
        label: data.label,
        company_name: data.company_name || null,
        address_line1: data.address_line1,
        address_line2: data.address_line2 || null,
        city: data.city,
        postcode: data.postcode,
        delivery_notes: data.delivery_notes || null,
        is_default: data.is_default,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("customer_addresses")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
