import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export type StaffMenuItem = Database["public"]["Tables"]["menu_items"]["Row"];

/**
 * Returns operational menu fields to staff without granting every authenticated
 * customer direct SELECT access to cost, barcode and KDS routing columns.
 */
export const getStaffMenuItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z.object({ site_id: z.string().uuid().optional() }).default({}).parse(value),
  )
  .handler(async ({ context, data }) => {
    const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
    ]);
    if (!isAdmin && !isStaff) throw new Error("Staff access required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("menu_items").select("*").order("sort_order");
    if (data.site_id) query = query.eq("site_id", data.site_id);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as StaffMenuItem[];
  });
