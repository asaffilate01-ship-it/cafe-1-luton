import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Line = z.object({
  menu_item_id: z.string().uuid(),
  qty: z.number().int().min(1).max(50),
  notes: z.string().max(200).optional(),
});

/**
 * Counter / till order taken in person by staff (cash or card machine).
 * Goes straight to the kitchen display as an already-paid ticket.
 */
export const createCounterOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        customer_name: z.string().min(1).max(100),
        type: z.enum(["dine_in", "collection", "delivery"]),
        table_number: z.string().max(20).optional(),
        payment_method: z.enum(["cash", "card"]),
        sumup_transaction_id: z.string().max(120).optional(),
        pos_terminal: z.enum(["jury", "judge", "public"]).optional(),
        items: z.array(Line).min(1).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
    ]);
    if (!isAdmin && !isStaff) throw new Error("Forbidden");

    const ids = data.items.map((i) => i.menu_item_id);
    const { data: menu, error: mErr } = await context.supabase
      .from("menu_items")
      .select("id, name, price_cents, active")
      .in("id", ids);
    if (mErr) throw new Error(mErr.message);
    const byId = new Map((menu ?? []).map((m) => [m.id, m]));

    let subtotal = 0;
    const lines = data.items.map((i) => {
      const m = byId.get(i.menu_item_id);
      if (!m) throw new Error("Item not found");
      subtotal += m.price_cents * i.qty;
      return {
        menu_item_id: m.id,
        name: m.name,
        qty: i.qty,
        unit_price_cents: m.price_cents,
        notes: i.notes || null,
      };
    });

    const { data: order, error } = await context.supabase
      .from("orders")
      .insert({
        customer_name: data.customer_name,
        customer_phone: "",
        type: data.type,
        table_number: data.type === "dine_in" ? data.table_number || null : null,
        subtotal_cents: subtotal,
        delivery_fee_cents: 0,
        discount_cents: 0,
        total_cents: subtotal,
        status: "preparing" as const,
        payment_status: "paid" as const,
        payment_method: data.payment_method,
        sumup_transaction_id: data.sumup_transaction_id ?? null,
        pos_terminal: data.pos_terminal ?? null,
        source: "counter",
        schedule_mode: "asap",
      })
      .select("id, order_number")
      .single();
    if (error) throw new Error(error.message);

    const { error: iErr } = await context.supabase
      .from("order_items")
      .insert(lines.map((l) => ({ ...l, order_id: order.id })));
    if (iErr) throw new Error(iErr.message);

    return { order_id: order.id, order_number: order.order_number, total_cents: subtotal };
  });
