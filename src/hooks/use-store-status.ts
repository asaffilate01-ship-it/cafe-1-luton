import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SITE_ID } from "@/hooks/use-sites";
import { computeStoreStatus, PUBLIC_SETTINGS_COLUMNS, type BankHoliday, type BusinessSettings, type HourRow } from "@/lib/business";
import { BRANCH_SITE_IDS, orderingHoursForLocation, type CafeLocationId } from "@/lib/nap";

const BRANCH_SITE_ENTRIES = Object.entries(BRANCH_SITE_IDS) as [CafeLocationId, string][];

function fallbackHoursForSite(siteId: string): HourRow[] {
  const branch = BRANCH_SITE_ENTRIES.find(([, branchSiteId]) => branchSiteId === siteId)?.[0];
  return branch ? orderingHoursForLocation(branch) : orderingHoursForLocation("luton-crown-court");
}

/**
 * Opening hours and store settings are per branch. Callers that render a
 * specific branch pass its site id; the default keeps the Crown Court branch
 * for the shared header/storefront.
 */
export function useStoreStatus(siteId: string = DEFAULT_SITE_ID) {
  const fallbackHours = fallbackHoursForSite(siteId);
  const { data } = useQuery({
    queryKey: ["store-status", siteId],
    staleTime: 60_000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [s, h, bh] = await Promise.all([
        supabase
          .from("business_settings")
          .select(PUBLIC_SETTINGS_COLUMNS)
          .eq("site_id", siteId)
          .limit(1)
          .maybeSingle(),
        supabase.from("business_hours").select("*").eq("site_id", siteId).order("day_of_week"),
        supabase.from("bank_holidays").select("holiday_date, name").gte("holiday_date", today).order("holiday_date"),
      ]);
      return {
        settings: (s.data ?? null) as BusinessSettings | null,
        hours: (h.data ?? []) as HourRow[],
        holidays: (bh.data ?? []) as BankHoliday[],
      };
    },
  });
  const hours = data?.hours.length ? data.hours : fallbackHours;
  const status = computeStoreStatus(hours, data?.settings ?? null, new Date(), data?.holidays ?? []);
  return { status, settings: data?.settings ?? null, hours, holidays: data?.holidays ?? [] };
}
