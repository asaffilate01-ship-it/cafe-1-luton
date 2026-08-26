import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callOperationsRpc } from "./ops-rpc";

export type CafeSite = {
  id: string;
  code: string;
  name: string;
  legal_name: string;
  trading_name: string;
  postcode: string | null;
  timezone: string;
  active: boolean;
  ordering_modes: string[];
  marketplace_delivery_enabled: boolean;
  own_delivery_enabled: boolean;
};

const SiteSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(120),
  legal_name: z.string().trim().min(2).max(160),
  trading_name: z.string().trim().min(2).max(120),
  postcode: z.string().trim().max(12).optional(),
  timezone: z.string().trim().min(3).max(80).default("Europe/London"),
  active: z.boolean().default(true),
  ordering_modes: z
    .array(z.enum(["dine_in", "collection", "jury_room_delivery", "delivery"]))
    .min(1),
  marketplace_delivery_enabled: z.boolean().default(false),
  own_delivery_enabled: z.boolean().default(false),
});

export const listSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => callOperationsRpc<CafeSite[]>(context.supabase, "cafe1_list_sites"));

export const saveSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => SiteSchema.parse(value))
  .handler(async ({ data, context }) => {
    return callOperationsRpc<CafeSite>(context.supabase, "cafe1_save_site", {
      _payload: data,
    });
  });
