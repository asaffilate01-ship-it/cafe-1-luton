import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guessCategory } from "@/lib/cooking";
import { requireStaffOrderAccess, requireStaffSiteAccess } from "./staff-site-access.server";

const LineSchema = z.object({
  name: z.string().min(1).max(120),
  qty: z.number().int().min(1).max(50),
  notes: z.string().max(200).optional(),
  menu_item_id: z.string().uuid().optional(),
});

/** Every order origin the kitchen may need to key in by hand. */
export const MANUAL_CHANNELS = [
  "deliveroo",
  "just_eat",
  "uber_eats",
  "tgtg",
  "jury",
  "judge",
  "public",
  "web",
  "phone",
] as const;
export type ManualChannel = (typeof MANUAL_CHANNELS)[number];

const OrderSchema = z.object({
  site_id: z.string().uuid(),
  channel: z.enum(MANUAL_CHANNELS),
  /** Short reference from the tablet/receipt, e.g. "F3K9". Optional for walk-ins. */
  reference: z.string().max(40).optional(),
  customer_name: z.string().max(100).optional(),
  type: z.enum(["delivery", "collection", "dine_in"]).default("collection"),
  total_cents: z.number().int().min(0).max(1_000_000).default(0),
  payment_method: z.enum(["card", "cash", "account", "platform"]).default("platform"),
  /** House account the tab charge belongs to (required for a real tab bill). */
  account_id: z.string().uuid().optional(),
  paid: z.boolean().default(true),
  notes: z.string().max(500).optional(),
  table_number: z.string().max(40).optional(),
  jury_room: z.string().max(120).optional(),
  address_line1: z.string().max(160).optional(),
  address_line2: z.string().max(160).optional(),
  company_name: z.string().max(160).optional(),
  postcode: z.string().max(20).optional(),
  customer_phone: z.string().max(40).optional(),
  items: z.array(LineSchema).min(1).max(60),
});

/**
 * Marketplaces only issue Orders API credentials to certified POS partners, and
 * phone/counter orders never have one at all. This lets staff key any order in
 * so it lands on the KDS badged with the right channel colour.
 */
const CHANNEL_ROUTING: Record<ManualChannel, { source: string; terminal: string | null }> = {
  deliveroo: { source: "deliveroo", terminal: null },
  just_eat: { source: "just_eat", terminal: null },
  uber_eats: { source: "uber_eats", terminal: null },
  tgtg: { source: "tgtg", terminal: null },
  jury: { source: "counter", terminal: "jury" },
  judge: { source: "counter", terminal: "judge" },
  public: { source: "counter", terminal: "public" },
  web: { source: "web", terminal: null },
  phone: { source: "web", terminal: null },
};

const FALLBACK_NAME: Record<ManualChannel, string> = {
  deliveroo: "Deliveroo customer",
  just_eat: "Just Eat customer",
  uber_eats: "Uber Eats customer",
  tgtg: "Too Good To Go",
  jury: "Juror",
  judge: "Judge",
  public: "Counter customer",
  web: "Website customer",
  phone: "Phone order",
};

export const createManualOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => OrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireStaffSiteAccess(context, data.site_id);

    const routing = CHANNEL_ROUTING[data.channel];
    const reference = data.reference?.trim().toUpperCase() || "";
    // Only marketplaces issue a genuinely unique order reference. On counter,
    // court and phone tickets staff reuse loose labels ("CURRY CLUB"), so
    // de-duplicating on those silently swallowed the second real order.
    const MARKETPLACES: ManualChannel[] = ["deliveroo", "just_eat", "uber_eats", "tgtg"];
    const dedupeKey =
      reference && MARKETPLACES.includes(data.channel)
        ? `manual:${data.channel}:${reference}`
        : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (dedupeKey) {
      const { data: existing } = await supabaseAdmin
        .from("orders")
        .select("id, order_number")
        .eq("deliveroo_order_id", dedupeKey)
        // A marketplace recycles its short references, so only treat a recent
        // ticket as the same order.
        .gte("created_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (existing) {
        return {
          order_id: existing.id,
          duplicate: true as const,
          order_number: existing.order_number as number,
        };
      }
    }

    const units = data.items.reduce((sum, line) => sum + line.qty, 0);
    const total = data.total_cents;

    const { data: inserted, error } = await supabaseAdmin
      .from("orders")
      .insert({
        site_id: data.site_id,
        customer_name: data.customer_name?.trim() || FALLBACK_NAME[data.channel],
        customer_phone: data.customer_phone?.trim() || "",
        type: data.type,
        status: "preparing",
        payment_status: data.paid
          ? "paid"
          : data.payment_method === "account"
            ? "on_account"
            : "pending",
        account_id: data.payment_method === "account" ? (data.account_id ?? null) : null,
        payment_method: data.payment_method,
        subtotal_cents: total,
        delivery_fee_cents: 0,
        discount_cents: 0,
        promo_discount_cents: 0,
        voucher_cents: 0,
        points_earned: 0,
        total_cents: total,
        schedule_mode: "asap",
        scheduled_for: null,
        source: routing.source,
        pos_terminal: routing.terminal,
        deliveroo_order_id: dedupeKey,
        sumup_reference: dedupeKey ? null : reference || null,
        table_number: data.type === "dine_in" ? data.table_number?.trim() || null : null,
        jury_room: data.jury_room?.trim() || null,
        company_name: data.company_name?.trim() || null,
        address_line1: data.address_line1?.trim() || null,
        address_line2: data.address_line2?.trim() || null,
        postcode: data.postcode?.trim().toUpperCase() || null,
        delivery_notes: data.notes?.trim() || null,
      })
      .select("id")
      .single();

    if (error || !inserted) throw new Error(error?.message ?? "Could not create the ticket");

    const unit = units > 0 ? Math.round(total / units) : 0;
    const { error: lineError } = await supabaseAdmin.from("order_items").insert(
      data.items.map((line) => ({
        order_id: inserted.id,
        menu_item_id: line.menu_item_id ?? null,
        name: line.name.trim(),
        qty: line.qty,
        unit_price_cents: unit,
        // Without a category the kitchen card can't group the line under a
        // heading, so work one out from the dish name.
        category_label: guessCategory(line.name.trim()) ?? null,
        notes: line.notes?.trim() || null,
      })),
    );
    if (lineError) throw new Error(lineError.message);

    return { order_id: inserted.id, duplicate: false as const, order_number: null };
  });

const EditSchema = z.object({
  order_id: z.string().uuid(),
  customer_name: z.string().max(100).optional(),
  customer_phone: z.string().max(40).optional(),
  total_cents: z.number().int().min(0).max(1_000_000),
  payment_method: z.enum(["card", "cash", "account", "platform"]),
  account_id: z.string().uuid().nullable().optional(),
  paid: z.boolean(),
  notes: z.string().max(500).optional(),
  table_number: z.string().max(40).optional(),
  jury_room: z.string().max(120).optional(),
  company_name: z.string().max(160).optional(),
  address_line1: z.string().max(160).optional(),
  address_line2: z.string().max(160).optional(),
  postcode: z.string().max(20).optional(),
  items: z.array(LineSchema).min(1).max(60),
});

/**
 * Lets the counter correct a hand-keyed ticket (wrong amount, name, room or
 * items) without cancelling and re-sending it to the kitchen.
 */
export const updateManualOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => EditSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireStaffOrderAccess(context, data.order_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const total = data.total_cents;
    const units = data.items.reduce((sum, line) => sum + line.qty, 0);
    const unit = units > 0 ? Math.round(total / units) : 0;

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        customer_name: data.customer_name?.trim() || "Counter customer",
        customer_phone: data.customer_phone?.trim() || "",
        subtotal_cents: total,
        total_cents: total,
        payment_method: data.payment_method,
        payment_status: data.paid
          ? "paid"
          : data.payment_method === "account"
            ? "on_account"
            : "pending",
        account_id: data.payment_method === "account" ? (data.account_id ?? null) : null,
        table_number: data.table_number?.trim() || null,
        jury_room: data.jury_room?.trim() || null,
        company_name: data.company_name?.trim() || null,
        address_line1: data.address_line1?.trim() || null,
        address_line2: data.address_line2?.trim() || null,
        postcode: data.postcode?.trim().toUpperCase() || null,
        delivery_notes: data.notes?.trim() || null,
        // Once the kitchen types its own note, the till sweep must stop
        // pushing the till's note back over it a few seconds later.
        notes_manual: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);

    // Items are rewritten wholesale: staff edit the ticket as a list, not row by row.
    await supabaseAdmin.from("order_items").delete().eq("order_id", data.order_id);
    const { error: lineError } = await supabaseAdmin.from("order_items").insert(
      data.items.map((line) => ({
        order_id: data.order_id,
        menu_item_id: line.menu_item_id ?? null,
        name: line.name.trim(),
        qty: line.qty,
        unit_price_cents: unit,
        category_label: guessCategory(line.name.trim()) ?? null,
        notes: line.notes?.trim() || null,
      })),
    );
    if (lineError) throw new Error(lineError.message);

    return { ok: true as const };
  });
