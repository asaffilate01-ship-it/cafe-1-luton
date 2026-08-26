import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  requireStaffOrderAccess,
  requireStaffShiftAccess,
  requireStaffSiteAccess,
} from "./staff-site-access.server";

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
}

const TerminalSchema = z.enum(["jury", "judge", "public"]);
const SiteTerminalSchema = z.object({
  terminal: TerminalSchema,
  site_id: z.string().uuid(),
});

export const getTillShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => SiteTerminalSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireStaffSiteAccess(context, data.site_id);
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
    await requireStaffSiteAccess(context, data.site_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: site } = await supabaseAdmin
      .from("sites")
      .select("id")
      .eq("id", data.site_id)
      .eq("active", true)
      .maybeSingle();
    if (!site) throw new Error("That Café 1 branch is not active");

    // Shifts are branch-scoped. The old open_till_shift RPC only accepts a
    // terminal and therefore always opens against its default site. Inserting
    // the already-authorised shift with an explicit site prevents a Futures
    // House device from reassigning Crown Court's public shift.
    const { data: existing } = await supabaseAdmin
      .from("till_shifts")
      .select("*")
      .eq("site_id", data.site_id)
      .eq("terminal", data.terminal)
      .is("closed_at", null)
      .maybeSingle();
    if (existing) return existing;

    const { data: shift, error } = await supabaseAdmin
      .from("till_shifts")
      .insert({
        site_id: data.site_id,
        terminal: data.terminal,
        staff_id: context.userId,
        opening_float_cents: data.opening_float_cents,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
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
    await requireStaffShiftAccess(context, data.shift_id);
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
    await requireStaffShiftAccess(context, data.shift_id);
    const { data: event, error } = await context.supabase.rpc("record_till_cash_event", {
      _shift_id: data.shift_id,
      _event_type: data.event_type,
      _amount_cents: data.amount_cents,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return event;
  });

/** Recent branch till sales for authorised staff cancellations and refunds. */
export const listRecentTillOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ site_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaffSiteAccess(context, data.site_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, created_at, customer_name, type, total_cents, refunded_cents, payment_status, payment_method, status, source",
      )
      .eq("site_id", data.site_id)
      .in("source", ["counter", "website", "online"])
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return orders ?? [];
  });

async function isAdmin(context: StaffContext): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return Boolean(data);
}
