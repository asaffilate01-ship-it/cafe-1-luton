import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { requireStaffSiteAccess } from "./staff-site-access.server";

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
    const access = await requireStaffSiteAccess(context, data.site_id);
    const effectiveSiteId = data.site_id ?? access.siteId;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("menu_items").select("*").order("sort_order");
    if (effectiveSiteId) query = query.eq("site_id", effectiveSiteId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as StaffMenuItem[];
  });
