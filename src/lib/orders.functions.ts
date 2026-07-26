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
  account_code: z.string().min(3).max(40).optional(),
  promo_code: z.string().min(1).max(40).optional(),
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

    // Load business settings + hours for pricing + open/closed enforcement.
    const [{ data: settings }, { data: hoursRows }] = await Promise.all([
      supabase.from("business_settings").select("*").limit(1).maybeSingle(),
      supabase.from("business_hours").select("*").order("day_of_week"),
    ]);

    if (settings && !settings.accepting_orders) {
      throw new Error(settings.closed_message || "Sorry, we're not accepting orders right now.");
    }
    if (settings && subtotal < (settings.min_order_cents ?? 0)) {
      const min = (settings.min_order_cents / 100).toFixed(2);
      throw new Error(`Minimum order is £${min}.`);
    }
    // Enforce opening hours for ASAP orders. Scheduled pre-orders may be allowed even if closed now.
    if (data.schedule_mode === "asap" && hoursRows && settings) {
      const { computeStoreStatus } = await import("./business");
      const status = computeStoreStatus(hoursRows as never, settings as never);
      if (!status.open && !settings.allow_preorder_when_closed) {
        throw new Error("We're closed right now. Please try a scheduled order.");
      }
    }

    const baseDeliveryFee = settings?.delivery_fee_cents ?? 299;
    const freeThreshold = settings?.free_delivery_threshold_cents ?? null;
    let delivery_fee = data.type === "delivery"
      ? (freeThreshold && subtotal >= freeThreshold ? 0 : baseDeliveryFee)
      : 0;

    // Validate and apply promo code (public RPC).
    let promo_discount = 0;
    let applied_promo: string | null = null;
    let free_delivery_promo = false;
    if (data.promo_code) {
      const { data: rows, error: pErr } = await supabase.rpc("validate_promo_code", {
        _code: data.promo_code.trim().toUpperCase(),
        _subtotal_cents: subtotal,
        _order_type: data.type,
      });
      if (pErr) throw new Error(pErr.message);
      const row = (rows ?? [])[0];
      if (!row || !row.valid) throw new Error(row?.message || "That promo code isn't valid.");
      applied_promo = row.code;
      if (row.discount_type === "free_delivery") {
        free_delivery_promo = true;
        delivery_fee = 0;
      } else {
        promo_discount = Math.min(row.discount_cents ?? 0, subtotal);
      }
    }

    const loyalty_discount = userId ? Math.round(subtotal * LOYALTY_DISCOUNT_RATE) : 0;
    const discount = Math.min(subtotal, loyalty_discount + promo_discount);
    const total = Math.max(0, subtotal - discount) + delivery_fee;
    const points_earned = userId ? Math.floor(Math.max(0, subtotal - discount) / 100) * POINTS_PER_POUND : 0;
    const reference = `cafe1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Charge to a house-account tab if a valid code is supplied.
    let account_id: string | null = null;
    if (data.account_code) {
      const { data: rows, error: acctErr } = await supabase
        .rpc("verify_account_code", { _code: data.account_code.trim() });
      if (acctErr) throw new Error(acctErr.message);
      const row = (rows ?? [])[0];
      if (!row) throw new Error("That tab access code isn't valid or is no longer active.");
      account_id = row.id;
    }

    // Create SumUp checkout FIRST — if it fails, don't create a phantom unpaid order.
    let checkout_id: string | null = null;
    if (!account_id) {
      const { createSumUpCheckout } = await import("./sumup.server");
      try {
        const co = await createSumUpCheckout({
          reference,
          amount_cents: total,
          description: `Cafe1 order`,
          customer_email: data.customer_email || undefined,
        });
        checkout_id = co.id;
      } catch (e) {
        console.error("[SumUp] checkout create failed", e);
        throw new Error(
          "We couldn't start the card payment. Please try again in a moment, or contact us if it keeps failing.",
        );
      }
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id: userId,
        account_id,
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
        sumup_checkout_id: checkout_id,
        promo_code: applied_promo,
        promo_discount_cents: free_delivery_promo ? 0 : promo_discount,
        ...(account_id ? { payment_status: "on_account" as const, status: "paid" as const } : {}),
      })
      .select()
      .single();
    if (orderErr) throw new Error(orderErr.message);

    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(lines.map((l) => ({ ...l, order_id: order.id })));
    if (itemsErr) throw new Error(itemsErr.message);

    // Increment promo usage counter (service_role only).
    if (applied_promo) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.rpc("increment_promo_use", { _code: applied_promo });
      } catch (e) {
        console.error("[promo] increment failed", e);
      }
    }

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

    return {
      order_id: order.id,
      order_number: order.order_number,
      total_cents: total,
      checkout_id,
      payment_configured: !!checkout_id,
      on_tab: !!account_id,
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
        status: "paid",
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
      .update({ driver_id: data.driver_id, status: "out_for_delivery", picked_up_at: new Date().toISOString() })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "driver");
    if (error) throw new Error(error.message);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (!ids.length) return [] as { id: string; full_name: string | null; email: string | null }[];
    const { data: profs } = await context.supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    return (profs ?? []) as { id: string; full_name: string | null; email: string | null }[];
  });