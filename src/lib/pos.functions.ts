import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callOperationsRpc } from "./ops-rpc";

const CounterLineSchema = z.object({
  menu_item_id: z.string().uuid(),
  qty: z.number().int().min(1).max(50),
  notes: z.string().max(200).optional(),
  modifier_ids: z.array(z.string().uuid()).max(20).optional(),
});

const CounterBasketSchema = z.object({
  idempotency_key: z.string().uuid(),
  shift_id: z.string().uuid(),
  customer_name: z.string().min(1).max(100),
  type: z.enum(["dine_in", "collection"]),
  table_number: z.string().max(20).optional(),
  pos_terminal: z.enum(["jury", "judge", "public"]),
  voucher_code: z.string().min(1).max(40).optional(),
  items: z.array(CounterLineSchema).min(1).max(60),
});

type CounterBasket = z.infer<typeof CounterBasketSchema>;

function rpcArgs(
  data: CounterBasket,
  paymentMode: "reader" | "cash" | "manual",
  manualCardReference = "",
) {
  return {
    _idempotency_key: data.idempotency_key,
    _shift_id: data.shift_id,
    _customer_name: data.customer_name,
    _order_type: data.type,
    _table_number: data.table_number ?? "",
    _terminal: data.pos_terminal,
    _voucher_code: data.voucher_code ?? "",
    _payment_mode: paymentMode,
    _manual_card_reference: manualCardReference,
    _items: data.items,
  };
}

function firstResult<T>(rows: T[] | null, message: string): T {
  const row = rows?.[0];
  if (!row) throw new Error(message);
  return row;
}

/**
 * Marks a counter order as being wanted for a later time so the kitchen
 * display shows it as a pre-order instead of starting it straight away.
 */
export const setCounterOrderSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        scheduled_for: z.string().datetime().nullable(),
      })
      .parse(input),
  )
  .handler(({ data, context }) =>
    callOperationsRpc<{ id: string; scheduled_for: string | null }>(
      context.supabase,
      "set_counter_order_schedule",
      { _order_id: data.order_id, _scheduled_for: data.scheduled_for },
    ),
  );

/**
 * Reserves a counter order, including any juror allowance, before a reader is
 * charged. The database calculates all prices and inserts the order/items in a
 * single transaction. It remains hidden from the KDS until payment is verified.
 */
export const prepareCounterOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CounterBasketSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc(
      "prepare_counter_order",
      rpcArgs(data, "reader"),
    );
    if (error) throw new Error(error.message);
    return firstResult(rows, "Could not prepare that counter order");
  });

/**
 * Settles cash sales transactionally. A manual external-terminal card sale is
 * intentionally manager-only and requires its receipt reference.
 */
export const createCounterOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    CounterBasketSchema.extend({
      payment_method: z.enum(["cash", "card"]),
      manual_card_reference: z.string().min(4).max(120).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.payment_method === "card" && !data.manual_card_reference) {
      throw new Error("A card terminal receipt reference is required");
    }
    if (data.payment_method === "card") {
      const { requireManagerMfa } = await import("./elevated-auth.server");
      requireManagerMfa(context.claims);
    }
    const { data: rows, error } = await context.supabase.rpc(
      "prepare_counter_order",
      rpcArgs(
        data,
        data.payment_method === "cash" ? "cash" : "manual",
        data.manual_card_reference ?? "",
      ),
    );
    if (error) throw new Error(error.message);
    return firstResult(rows, "Could not settle that counter order");
  });

/** Finalizes a previously prepared reader order using a verified attempt. */
export const finalizeCounterCardPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        payment_attempt_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase.rpc("finalize_counter_card", {
      _order_id: data.order_id,
      _payment_attempt_id: data.payment_attempt_id,
    });
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Could not finalize that card payment");
    return {
      order_id: order.id,
      order_number: order.order_number,
      total_cents: order.total_cents,
      subtotal_cents: order.subtotal_cents,
      voucher_cents: order.voucher_cents,
      voucher_code: null as string | null,
      juror_discount_cents: order.juror_discount_cents,
    };
  });

/** Releases a prepared order and voucher hold after a cancelled reader flow. */
export const cancelCounterOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ order_id: z.string().uuid(), reason: z.string().min(3).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: unsettled } = await supabaseAdmin
      .from("payment_attempts")
      .select("id, status")
      .eq("order_id", data.order_id)
      .in("status", ["pending", "paid", "used"])
      .limit(1);
    if (unsettled?.length) {
      throw new Error(
        "Payment is still pending verification. Do not recreate or re-charge this order.",
      );
    }
    const { data: cancelled, error } = await context.supabase.rpc("cancel_counter_order", {
      _order_id: data.order_id,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: cancelled };
  });
