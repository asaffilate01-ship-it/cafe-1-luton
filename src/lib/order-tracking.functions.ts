import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public order tracking. The order UUID acts as the bearer secret (it is only
 * ever shown to the person who placed the order), so this returns a narrow,
 * safe projection instead of exposing the whole table to anonymous readers.
 */
export const getPublicOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, status, payment_status, type, total_cents, customer_name, created_at, scheduled_for, schedule_mode, sumup_checkout_id",
      )
      .eq("id", data.order_id)
      .maybeSingle();
    if (!order) return { order: null, items: [], driver: null };

    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("id, name, qty, unit_price_cents")
      .eq("order_id", data.order_id);

    let driver: { lat: number; lng: number; updated_at: string } | null = null;
    if (order.type === "delivery" && order.status === "out_for_delivery") {
      const { data: loc } = await supabaseAdmin
        .from("driver_locations")
        .select("lat, lng, updated_at")
        .eq("order_id", data.order_id)
        .maybeSingle();
      driver = loc ?? null;
    }

    return { order, items: items ?? [], driver };
  });
