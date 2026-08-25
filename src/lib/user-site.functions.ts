import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: {
  userId: string;
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => PromiseLike<{ data: unknown }>;
  };
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Admins only");
}

export const listStaffSiteAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    return Object.fromEntries(
      data.users.map((user) => [
        user.id,
        typeof user.app_metadata?.site_id === "string" ? user.app_metadata.site_id : null,
      ]),
    ) as Record<string, string | null>;
  });

export const assignStaffSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z.object({ user_id: z.string().uuid(), site_id: z.string().uuid() }).parse(value),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: site, error: siteError } = await supabaseAdmin
      .from("sites")
      .select("id")
      .eq("id", data.site_id)
      .eq("active", true)
      .maybeSingle();
    if (siteError) throw new Error(siteError.message);
    if (!site) throw new Error("That branch is not available");

    const { data: current, error: getError } = await supabaseAdmin.auth.admin.getUserById(
      data.user_id,
    );
    if (getError || !current.user) throw new Error(getError?.message ?? "User not found");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      app_metadata: { ...current.user.app_metadata, site_id: data.site_id },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
