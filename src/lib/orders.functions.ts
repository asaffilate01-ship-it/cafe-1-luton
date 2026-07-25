import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function createServerSupabase(bearer?: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        if (bearer) h.set("Authorization", `Bearer ${bearer}`);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const LOYALTY_DISCOUNT_RATE = 0.1; // 10% off for signed-in customers
export const POINTS_PER_POUND = 1;

const CartItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  qty: z.number().int().min(1).max(50),
  notes: z.string().max(200).optional(),
});

const CreateOrderSchema = z.object({
  type: z.enum(["delivery", "collection", "dine_in"]),
  customer_name: z.string().min(1).max(100),
  customer_phone: z.string().min(3).max(30),
  customer_email: z.string().email().optional().or(z.literal("")),
  company_name: z.string().max(120).optional(),
  address_line1: z.string().max(200).optional(),
  address_line2: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  postcode: z.string().max(20).optional(),
  delivery_notes: z.string().max(500).optional(),
  table_number: z.string().max(20).optional(),
  schedule_mode: z.enum(["asap", "scheduled"]).default("asap"),
  scheduled_for: z.string().datetime().optional(),
  items: z.array(CartItemSchema).min(1).max(50),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateOrderSchema.parse(d))
  .handler(async ({ data }) => {
    // Optional auth: signed-in customers get discount + points.
    const req = getRequest();
    const authHeader = req?.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const validToken = token && token.split(".").length === 3 ? token : "";
    const supabase = createServerSupabase(validToken || undefined);
    let userId: string | null = null;
    if (validToken) {
      const { data: u } = await supabase.auth.getUser(validToken);
      userId = u.user?.id ?? null;
    }

    const ids = data.items.map((i) => i.menu_item_id);
    const { data: menu, error: menuErr } = await supabase
      .from("menu_items")
      .select("id,name,price_cents,active")
      .in("id", ids);
    if (menuErr) throw new Error(menuErr.message);
    const byId = new Map((menu ?? []).map((m) => [m.id, m]));

    let subtotal = 0;
    const lines = data.items.map((i) => {
      const m = byId.get(i.menu_item_id);
      if (!m || !m.active) throw new Error(`Item unavailable`);
      subtotal += m.price_cents * i.qty;
      return {
        menu_item_id: m.id,
        name: m.name,
        qty: i.qty,
        unit_price_cents: m.price_cents,
        notes: i.notes ?? null,
      };
    });

    const delivery_fee = data.type === "delivery" ? 299 : 0;
    const discount = userId ? Math.round(subtotal * LOYALTY_DISCOUNT_RATE) : 0;
    const total = Math.max(0, subtotal - discount) + delivery_fee;
    const points_earned = userId ? Math.floor(Math.max(0, subtotal - discount) / 100) * POINTS_PER_POUND : 0;
    const reference = `cafe1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id: userId,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email || null,
        type: data.type,
        address_line1: data.address_line1 || null,
        address_line2: data.address_line2 || null,
        city: data.city || null,
        postcode: data.postcode || null,
        delivery_notes: data.delivery_notes || null,
        company_name: data.company_name || null,
        table_number: data.table_number || null,
        schedule_mode: data.schedule_mode,
        scheduled_for: data.schedule_mode === "scheduled" ? data.scheduled_for ?? null : null,
        subtotal_cents: subtotal,
        delivery_fee_cents: delivery_fee,
        discount_cents: discount,
        points_earned,
        total_cents: total,
        sumup_reference: reference,
      })
      .select()
      .single();
    if (orderErr) throw new Error(orderErr.message);

    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(lines.map((l) => ({ ...l, order_id: order.id })));
    if (itemsErr) throw new Error(itemsErr.message);

    // Award loyalty points immediately for authed customers.
    if (userId && points_earned > 0) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("loyalty_points, lifetime_points")
        .eq("id", userId)
        .maybeSingle();
      await supabase
        .from("profiles")
        .update({
          loyalty_points: (prof?.loyalty_points ?? 0) + points_earned,
          lifetime_points: (prof?.lifetime_points ?? 0) + points_earned,
        })
        .eq("id", userId);
    }

    let checkout_url: string | null = null;
    let checkout_id: string | null = null;
    try {
      const { createSumUpCheckout } = await import("./sumup.server");
      const origin =
        process.env.APP_URL ||
        "https://project--4e8d727f-9796-42a7-9a37-e92941913d6a.lovable.app";
      const co = await createSumUpCheckout({
        reference,
        amount_cents: total,
        description: `Cafe1 order #${order.order_number}`,
        return_url: `${origin}/order/${order.id}`,
        customer_email: data.customer_email || undefined,
      });
      checkout_id = co.id;
      checkout_url = co.hosted_checkout_url ?? null;
      await supabase.from("orders").update({ sumup_checkout_id: co.id }).eq("id", order.id);
    } catch (e) {
      console.error("[SumUp] checkout create failed", e);
    }

    return {
      order_id: order.id,
      order_number: order.order_number,
      total_cents: total,
      checkout_url,
      checkout_id,
      payment_configured: !!checkout_id,
    };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        status: z.enum([
          "paid",
          "preparing",
          "ready",
          "out_for_delivery",
          "delivered",
          "completed",
          "cancelled",
          "refunded",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const patch = {
      status: data.status,
      ...(data.status === "ready" ? { ready_at: now } : {}),
      ...(data.status === "out_for_delivery" ? { picked_up_at: now } : {}),
      ...(data.status === "delivered" || data.status === "completed"
        ? { delivered_at: now }
        : {}),
    };
    const { error } = await context.supabase
      .from("orders")
      .update(patch)
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markPaidManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ order_id: z.string().uuid(), sumup_transaction_id: z.string().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("orders")
      .update({
        payment_status: "paid",
        status: "preparing",
        sumup_transaction_id: data.sumup_transaction_id ?? null,
      })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ order_id: z.string().uuid(), driver_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("orders")
      .update({ driver_id: data.driver_id })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });