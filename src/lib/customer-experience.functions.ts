import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callOperationsRpc } from "./ops-rpc";

export const getCustomerFavourites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    callOperationsRpc<string[]>(context.supabase, "cafe1_customer_favourites"),
  );

export const toggleFavourite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ menu_item_id: z.string().uuid() }).parse(value))
  .handler(({ data, context }) =>
    callOperationsRpc<boolean>(context.supabase, "cafe1_toggle_favourite", {
      _menu_item_id: data.menu_item_id,
    }),
  );

export const submitOrderFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(1000).default(""),
      })
      .parse(value),
  )
  .handler(({ data, context }) =>
    callOperationsRpc<string>(context.supabase, "cafe1_submit_feedback", {
      _order_id: data.order_id,
      _rating: data.rating,
      _comment: data.comment,
    }),
  );
