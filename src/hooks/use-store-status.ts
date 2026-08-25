import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeStoreStatus, type BankHoliday, type BusinessSettings, type HourRow } from "@/lib/business";

export function useStoreStatus() {
  const { data } = useQuery({
    queryKey: ["store-status"],
    staleTime: 60_000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [s, h, bh] = await Promise.all([
        supabase
          .from("business_settings")
          .select(PUBLIC_SETTINGS_COLUMNS)
          .limit(1)
          .maybeSingle(),
        supabase.from("business_hours").select("*").order("day_of_week"),
        supabase.from("bank_holidays").select("holiday_date, name").gte("holiday_date", today).order("holiday_date"),
      ]);
      return {
        settings: (s.data ?? null) as BusinessSettings | null,
        hours: (h.data ?? []) as HourRow[],
        holidays: (bh.data ?? []) as BankHoliday[],
      };
    },
  });
  const status = computeStoreStatus(data?.hours ?? [], data?.settings ?? null, new Date(), data?.holidays ?? []);
  return { status, settings: data?.settings ?? null, hours: data?.hours ?? [], holidays: data?.holidays ?? [] };
}