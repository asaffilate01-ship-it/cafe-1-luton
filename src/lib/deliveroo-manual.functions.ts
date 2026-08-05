import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LineSchema = z.object({
  name: z.string().min(1).max(120),
  qty: z.number().int().min(1).max(50),
  notes: z.string().max(200).optional(),
});

const TicketSchema = z.object({
  /** Short reference printed on the Deliveroo tablet/receipt, e.g. "F3K9". */
  reference: z.string().min(1).max(40),
  customer_name: z.string().max(100).optional(),
  type: z.enum(["delivery", "collection"]).default("delivery"),
  total_cents: z.number().int().min(0).max(1_000_000).default(0),
  notes: z.string().max(500).optional(),
  items: z.array(LineSchema).min(1).max(60),
});

/**
 * Create a Deliveroo ticket on the KDS by hand.
 *
 * Deliveroo only issues Orders API credentials to certified POS partners, so
 * until Cafe1 is connected through one, staff key the tablet order in here and
 * it appears on the kitchen display badged as Deliveroo, exactly like a
 * webhook-ingested order would.
 */
export const createManualDeliverooTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TicketSchema.parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
    ]);
    if (!isAdmin && !isStaff) throw new Error("Kitchen or manager access required");

    const ref = `manual:${data.reference.trim().toUpperCase()}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("deliveroo_order_id", ref)
      .maybeSingle();
    if (existing) return { order_id: existing.id, duplicate: true as const };

    const computed = data.items.reduce((sum, line) => sum + line.qty, 0);
    const total = data.total_cents;

    const { data: inserted, error } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name: data.customer_name?.trim() || "Deliveroo customer",
        customer_phone: "",
        type: data.type,
        status: "preparing",
        payment_status: "paid",
        payment_method: "card",
        subtotal_cents: total,
        delivery_fee_cents: 0,
        discount_cents: 0,
        promo_discount_cents: 0,
        voucher_cents: 0,
        points_earned: 0,
        total_cents: total,
        schedule_mode: "asap",
        scheduled_for: null,
        source: "deliveroo",
        deliveroo_order_id: ref,
        delivery_notes: data.notes?.trim() || null,
      })
      .select("id")
      .single();

    if (error || !inserted) throw new Error(error?.message ?? "Could not create the ticket");

    const unit = computed > 0 ? Math.round(total / computed) : 0;
    const { error: lineError } = await supabaseAdmin.from("order_items").insert(
      data.items.map((line) => ({
        order_id: inserted.id,
        name: line.name.trim(),
        qty: line.qty,
        unit_price_cents: unit,
        notes: line.notes?.trim() || null,
      })),
    );
    if (lineError) throw new Error(lineError.message);

    return { order_id: inserted.id, duplicate: false as const };
  });
