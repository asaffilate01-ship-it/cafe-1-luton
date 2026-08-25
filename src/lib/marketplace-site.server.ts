/** Resolve the site that owns every third-party marketplace order. */
export async function resolveCrownCourtSiteId(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const byCode = await supabaseAdmin
    .from("sites")
    .select("id")
    .eq("active", true)
    .eq("code", "LUTON_CROWN_COURT")
    .limit(1)
    .maybeSingle();
  if (byCode.data?.id) return byCode.data.id;

  const byPostcode = await supabaseAdmin
    .from("sites")
    .select("id")
    .eq("active", true)
    .eq("postcode", "LU1 2AA")
    .limit(1)
    .maybeSingle();
  return byPostcode.data?.id ?? null;
}
