import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Public: check whether a postcode is inside the delivery radius. */
export const checkDeliveryPostcode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ postcode: z.string().min(3).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: settings } = await supabase
      .from("business_settings")
      .select("delivery_origin_postcode,delivery_radius_m,delivery_open_time,delivery_close_time")
      .limit(1)
      .maybeSingle();
    if (!settings) return { ok: true as const, distance_m: 0, radius_m: 805 };
    const { checkDeliveryArea } = await import("./delivery.server");
    return checkDeliveryArea(data.postcode, settings);
  });
