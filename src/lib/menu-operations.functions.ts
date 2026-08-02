import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type StaffMenuItem = Database["public"]["Tables"]["menu_items"]["Row"];

/**
 * Returns operational menu fields to staff without granting every authenticated
 * customer direct SELECT access to cost, barcode and KDS routing columns.
 */
export const getStaffMenuItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
    ]);
    if (!isAdmin && !isStaff) throw new Error("Staff access required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("menu_items").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as StaffMenuItem[];
  });
