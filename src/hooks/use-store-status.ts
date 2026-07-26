import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeStoreStatus, type BusinessSettings, type HourRow } from "@/lib/business";

export function useStoreStatus() {
  const { data } = useQuery({
    queryKey: ["store-status"],
    staleTime: 60_000,
    queryFn: async () => {
      const [s, h] = await Promise.all([
        supabase.from("business_settings").select("*").limit(1).maybeSingle(),
        supabase.from("business_hours").select("*").order("day_of_week"),
      ]);
      return {
        settings: (s.data ?? null) as BusinessSettings | null,
        hours: (h.data ?? []) as HourRow[],
      };
    },
  });
  const status = computeStoreStatus(data?.hours ?? [], data?.settings ?? null);
  return { status, settings: data?.settings ?? null, hours: data?.hours ?? [] };
}