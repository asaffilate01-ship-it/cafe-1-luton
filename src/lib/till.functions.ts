import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type StaffContext = {
  userId: string;
  claims: unknown;
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" | "staff" },
    ) => PromiseLike<{ data: unknown }>;
  };
};

async function assertStaff(context: StaffContext) {
  const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
  ]);
  if (!isAdmin && !isStaff) throw new Error("Forbidden");
}

async function assertAdmin(context: StaffContext) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Manager approval required");
  const { requireManagerMfa } = await import("./elevated-auth.server");
  requireManagerMfa(context.claims);
}

const TerminalSchema = z.enum(["jury", "judge", "public", "futures_public"]);
const SiteTerminalSchema = z.object({
  terminal: TerminalSchema,
  site_id: z.string().uuid(),
});

export const getTillShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => SiteTerminalSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: shift, error } = await context.supabase
      .from("till_shifts")
      .select("*")
      .eq("terminal", data.terminal)
      .eq("site_id", data.site_id)
      .is("closed_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return shift;
  });

export const openTillShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        terminal: TerminalSchema,
        site_id: z.string().uuid(),
        opening_float_cents: z.number().int().min(0).max(1_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: openedShift, error } = await context.supabase.rpc("open_till_shift", {
      _terminal: data.terminal,
      _opening_float_cents: data.opening_float_cents,
    });
    if (error) throw new Error(error.message);
    if (!openedShift) throw new Error("Could not open the till shift");
    if (openedShift.site_id === data.site_id) return openedShift;

    // The legacy RPC opens against the default site. A branch-specific
    // terminal name keeps shifts distinct; attach the new shift to the branch
    // selected on this device before any sale is taken.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: site } = await supabaseAdmin
      .from("sites")
      .select("id")
      .eq("id", data.site_id)
      .eq("active", true)
      .maybeSingle();
    if (!site) throw new Error("That Café 1 branch is not active");
    const { data: shift, error: updateError } = await supabaseAdmin
      .from("till_shifts")
      .update({ site_id: data.site_id })
      .eq("id", openedShift.id)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);
    return shift;
  });

export const closeTillShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        shift_id: z.string().uuid(),
        counted_cash_cents: z.number().int().min(0).max(10_000_000),
        note: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: shift, error } = await context.supabase.rpc("close_till_shift", {
      _shift_id: data.shift_id,
      _counted_cash_cents: data.counted_cash_cents,
      _note: data.note ?? "",
    });
    if (error) throw new Error(error.message);
    return shift;
  });

export const recordTillCashEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        shift_id: z.string().uuid(),
        event_type: z.enum(["paid_in", "paid_out", "drawer_open"]),
        amount_cents: z.number().int().min(0).max(1_000_000),
        reason: z.string().max(200).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: event, error } = await context.supabase.rpc("record_till_cash_event", {
      _shift_id: data.shift_id,
      _event_type: data.event_type,
      _amount_cents: data.amount_cents,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return event;
  });

/** Card readers (SumUp Solo) paired to this merchant account. */
export const listPairedReaders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { listReaders } = await import("./sumup-readers.server");
    try {
      const readers = await listReaders();
      return {
        ok: true as const,
        readers: readers.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status ?? "unknown",
          model: r.device?.model ?? null,
        })),
      };
    } catch (e) {
      return {
        ok: false as const,
        readers: [],
        error: e instanceof Error ? e.message : "Could not reach SumUp",
      };
    }
  });

/** Pairs a Solo device using the pairing code shown on its screen. */
export const pairSumupReader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ pairing_code: z.string().min(4).max(20), name: z.string().min(1).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { pairReader } = await import("./sumup-readers.server");
    const r = await pairReader(data.pairing_code, data.name);
    return { id: r.id, name: r.name };
  });

export const unpairSumupReader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ reader_id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { unpairReader } = await import("./sumup-readers.server");
    await unpairReader(data.reader_id);
    return { ok: true };
  });

/** Pushes the basket total to the Solo device so the customer can tap. */
export const startReaderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        reader_id: z.string().min(1),
        order_id: z.string().uuid(),
        cash_component_cents: z.number().int().min(0).max(500000).default(0),
        description: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, source, status, payment_status, total_cents")
      .eq("id", data.order_id)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (
      !order ||
      order.source !== "counter" ||
      order.status !== "pending_payment" ||
      order.payment_status !== "pending" ||
      order.total_cents < 1
    ) {
      throw new Error("That counter order is not awaiting a reader payment");
    }
    if (data.cash_component_cents >= order.total_cents) {
      throw new Error("Cash split must leave at least 1p for the card reader");
    }
    const readerAmountCents = order.total_cents - data.cash_component_cents;

    const attemptId = crypto.randomUUID();
    const reference = `CAFE1-${order.order_number}-${attemptId.slice(0, 8)}`;
    const { error: insertError } = await supabaseAdmin.from("payment_attempts").insert({
      id: attemptId,
      order_id: order.id,
      provider_reference: reference,
      reader_id: data.reader_id,
      amount_cents: readerAmountCents,
      cash_component_cents: data.cash_component_cents,
      created_by: context.userId,
    });
    if (insertError) throw new Error(insertError.message);

    // Show the actual items on the SumUp receipt/transaction so sales can be
    // analysed in SumUp, not just "Cafe 1 order #N".
    let itemSummary = "";
    try {
      const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("qty, name")
        .eq("order_id", order.id);
      itemSummary = (items ?? []).map((i) => `${i.qty}x ${i.name}`).join(", ");
    } catch {
      itemSummary = "";
    }
    const baseDescription = itemSummary
      ? `#${order.order_number} ${itemSummary}`
      : `Cafe 1 order #${order.order_number}`;
    const description = (data.description ?? baseDescription).slice(0, 250);

    const { readerCheckout } = await import("./sumup-readers.server");
    try {
      const out = await readerCheckout({
        readerId: data.reader_id,
        amount_cents: readerAmountCents,
        description,
        reference,
      });
      const { error: updateError } = await supabaseAdmin
        .from("payment_attempts")
        .update({
          client_transaction_id: out.client_transaction_id,
          status: "pending",
        })
        .eq("id", attemptId);
      if (updateError) throw new Error(updateError.message);
      return { ...out, payment_attempt_id: attemptId, amount_cents: readerAmountCents };
    } catch (error) {
      await supabaseAdmin
        .from("payment_attempts")
        .update({
          status: "failed",
          failure_reason:
            error instanceof Error ? error.message.slice(0, 500) : "Reader start failed",
        })
        .eq("id", attemptId);
      throw error;
    }
  });

export const checkReaderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ payment_attempt_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: attempt, error } = await supabaseAdmin
      .from("payment_attempts")
      .select("*")
      .eq("id", data.payment_attempt_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!attempt || (attempt.created_by !== context.userId && !(await isAdmin(context)))) {
      throw new Error("Payment attempt not found");
    }
    const { settleReaderAttempt } = await import("./reader-settle.server");
    return settleReaderAttempt(attempt);
  });

export const cancelReaderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({ reader_id: z.string().min(1), payment_attempt_id: z.string().uuid().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { terminateReaderCheckout } = await import("./sumup-readers.server");
    try {
      await terminateReaderCheckout(data.reader_id);
    } catch {
      /* the reader may already be idle */
    }
    if (data.payment_attempt_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: attempt } = await supabaseAdmin
        .from("payment_attempts")
        .select("*")
        .eq("id", data.payment_attempt_id)
        .eq("created_by", context.userId)
        .maybeSingle();
      if (attempt?.status === "created") {
        await supabaseAdmin
          .from("payment_attempts")
          .update({ status: "cancelled", failure_reason: "Cancelled before reader start" })
          .eq("id", attempt.id);
      } else if (attempt?.status === "pending" && attempt.client_transaction_id) {
        const { getReaderTransaction } = await import("./sumup-readers.server");
        const transaction = await getReaderTransaction(attempt.client_transaction_id);
        const status = transaction?.status?.toUpperCase() ?? "PENDING";
        if (status === "SUCCESSFUL" || status === "PAID") {
          const transactionId = transaction?.id ?? transaction?.transaction_code;
          if (transactionId) {
            await supabaseAdmin
              .from("payment_attempts")
              .update({ status: "paid", provider_transaction_id: transactionId })
              .eq("id", attempt.id);
          }
          throw new Error(
            "Payment was approved while cancelling. The order will be recovered automatically.",
          );
        }
        if (["FAILED", "CANCELLED", "CANCELED"].includes(status)) {
          await supabaseAdmin
            .from("payment_attempts")
            .update({ status: "cancelled", failure_reason: `Reader returned ${status}` })
            .eq("id", attempt.id);
        } else {
          throw new Error("Reader cancellation is still pending. Wait a moment and try again.");
        }
      }
    }
    return { ok: true };
  });

async function isAdmin(context: StaffContext): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return Boolean(data);
}
