import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireStaffSiteAccess } from "./staff-site-access.server";

const ORDER_COLUMNS =
  "id, order_number, status, type, customer_name, created_at, schedule_mode, scheduled_for, table_number, source, payment_method, payment_status, customer_phone, company_name, address_line1, address_line2, city, postcode, delivery_notes, pos_terminal, prepared_by, jury_room, court_location, site_id, delivered_at";

/**
 * Loads one branch's kitchen board behind the server-side branch guard. This
 * prevents a staff browser from changing a query parameter to read the other
 * café's order names, notes or tickets.
 */
export const getKitchenBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z.object({ site_id: z.string().uuid(), recall: z.boolean().default(false) }).parse(value),
  )
  .handler(async ({ data, context }) => {
    await requireStaffSiteAccess(context, data.site_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: active, error: activeError } = await supabaseAdmin
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("site_id", data.site_id)
      .in("status", ["preparing", "ready"])
      .order("created_at");
    if (activeError) throw new Error(activeError.message);
    // A website/pre-order ticket must never appear in the kitchen until its
    // online card payment has been confirmed. `on_account` is retained only
    // for the separately authorised Crown Court judge-tab flow.
    const visibleActive = (active ?? []).filter(
      (order) =>
        !["website", "online"].includes(order.source) ||
        ["paid", "on_account"].includes(order.payment_status ?? ""),
    );

    let recent: typeof active = [];
    if (data.recall) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recalled, error: recalledError } = await supabaseAdmin
        .from("orders")
        .select(ORDER_COLUMNS)
        .eq("site_id", data.site_id)
        .gte("created_at", since)
        .in("status", ["paid", "preparing", "ready", "out_for_delivery", "delivered", "completed"])
        .order("created_at", { ascending: false })
        .limit(15);
      if (recalledError) throw new Error(recalledError.message);
      recent = recalled ?? [];
    }

    const orderIds = [...new Set([...visibleActive, ...(recent ?? [])].map((order) => order.id))];
    const [{ data: items, error: itemsError }, { data: categories, error: categoriesError }] =
      await Promise.all([
        orderIds.length
          ? supabaseAdmin
              .from("order_items")
              .select("id, order_id, menu_item_id, name, qty, notes, category_label")
              .in("order_id", orderIds)
          : Promise.resolve({ data: [], error: null }),
        supabaseAdmin.from("menu_categories").select("id, name").eq("site_id", data.site_id),
      ]);
    if (itemsError) throw new Error(itemsError.message);
    if (categoriesError) throw new Error(categoriesError.message);

    return {
      active: visibleActive,
      recent: recent ?? [],
      items: items ?? [],
      categories: categories ?? [],
    };
  });
