/**
 * Server-side branch authorisation for the till and KDS.
 *
 * A staff account is locked to the active site stored in Supabase Auth
 * app_metadata.site_id. Administrators are deliberately allowed to work across
 * sites. Client-side branch selectors are only a convenience; every sensitive
 * server operation must call one of these guards as well.
 */
type BranchAccessContext = {
  userId: string;
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" | "staff" },
    ) => PromiseLike<{ data: unknown }>;
  };
};

export type StaffBranchAccess = {
  admin: boolean;
  siteId: string | null;
};

export async function getStaffBranchAccess(
  context: BranchAccessContext,
): Promise<StaffBranchAccess> {
  const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
  ]);

  if (isAdmin) return { admin: true, siteId: null };
  if (!isStaff) throw new Error("Staff access required");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
  if (error || !data.user) throw new Error(error?.message ?? "Staff account not found");
  const assigned = data.user.app_metadata?.site_id;
  if (
    typeof assigned !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assigned)
  ) {
    throw new Error("No branch is assigned to this staff login. Ask an admin to assign one.");
  }
  const { data: site, error: siteError } = await supabaseAdmin
    .from("sites")
    .select("id")
    .eq("id", assigned)
    .eq("active", true)
    .maybeSingle();
  if (siteError) throw new Error(siteError.message);
  if (!site) throw new Error("The branch assigned to this staff login is not active.");
  return { admin: false, siteId: assigned };
}

export async function requireStaffSiteAccess(
  context: BranchAccessContext,
  requestedSiteId?: string | null,
): Promise<StaffBranchAccess> {
  const access = await getStaffBranchAccess(context);
  if (!access.admin && requestedSiteId && requestedSiteId !== access.siteId) {
    throw new Error("This staff login is assigned to a different Café 1 branch.");
  }
  return access;
}

export async function requireStaffOrderAccess(
  context: BranchAccessContext,
  orderId: string,
): Promise<StaffBranchAccess & { orderSiteId: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("site_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order?.site_id) throw new Error("Order not found");
  const access = await requireStaffSiteAccess(context, order.site_id);
  return { ...access, orderSiteId: order.site_id };
}

export async function requireStaffShiftAccess(
  context: BranchAccessContext,
  shiftId: string,
): Promise<StaffBranchAccess & { shiftSiteId: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: shift, error } = await supabaseAdmin
    .from("till_shifts")
    .select("site_id")
    .eq("id", shiftId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!shift?.site_id) throw new Error("Till shift not found");
  const access = await requireStaffSiteAccess(context, shift.site_id);
  return { ...access, shiftSiteId: shift.site_id };
}
