import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
/** Public: verify a tab access code — returns account id + name, or null. */
export const verifyTabCode = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code: z.string().min(3).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { checkThrottle, recordAttempt, requestIdentity } = await import("./rate-limit.server");
    const identity = requestIdentity();
    const gate = await checkThrottle("account", identity);
    if (!gate.allowed) return { ok: false as const, message: gate.message };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("verify_account_code", {
      _code: data.code.trim(),
    });
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0];
    await recordAttempt("account", identity, Boolean(row));
    if (!row) return { ok: false as const };
    return {
      ok: true as const,
      account_id: row.id,
      name: row.name,
      code: data.code.trim().toUpperCase(),
    };
  });

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const random = new Uint8Array(8);
  crypto.getRandomValues(random);
  let out = "";
  for (const value of random) out += alphabet[value % alphabet.length];
  return out;
}

async function codeHash(code: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

async function requireAdmin(context: {
  userId: string;
  claims: unknown;
  supabase: {
    rpc: (
      name: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => PromiseLike<{ data: unknown }>;
  };
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Manager approval required");
  const { requireManagerMfa } = await import("./elevated-auth.server");
  requireManagerMfa(context.claims);
}

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: accounts, error } = await context.supabase
      .from("accounts")
      .select(
        "id,name,contact_name,contact_email,contact_phone,credit_limit_cents,notes,active,created_at,updated_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: orders } = await context.supabase
      .from("orders")
      .select("account_id,total_cents,refunded_cents,payment_status")
      .not("account_id", "is", null);
    const { data: payments } = await context.supabase
      .from("account_payments")
      .select("account_id,amount_cents")
      .is("settled_at", null);
    const bal = new Map<string, number>();
    for (const o of orders ?? []) {
      if (o.payment_status === "on_account" && o.account_id)
        bal.set(
          o.account_id,
          (bal.get(o.account_id) ?? 0) + Math.max(0, o.total_cents - o.refunded_cents),
        );
    }
    for (const p of payments ?? []) {
      bal.set(p.account_id, (bal.get(p.account_id) ?? 0) - p.amount_cents);
    }
    return (accounts ?? []).map((a) => ({
      ...a,
      access_code: null as string | null,
      outstanding_cents: Math.max(bal.get(a.id) ?? 0, 0),
    }));
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        contact_name: z.string().max(120).optional(),
        contact_email: z.string().email().optional().or(z.literal("")),
        contact_phone: z.string().max(30).optional(),
        credit_limit_cents: z.number().int().min(0).optional(),
        notes: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    // retry a couple of times if the code collides
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const { data: row, error } = await context.supabase
        .from("accounts")
        .insert({
          name: data.name,
          contact_name: data.contact_name || null,
          contact_email: data.contact_email || null,
          contact_phone: data.contact_phone || null,
          credit_limit_cents: data.credit_limit_cents ?? null,
          notes: data.notes || null,
          access_code_hash: await codeHash(code),
        })
        .select(
          "id,name,contact_name,contact_email,contact_phone,credit_limit_cents,notes,active,created_at,updated_at",
        )
        .single();
      if (!error) return { ...row, access_code: code };
      if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    }
    throw new Error("Could not generate a unique access code, try again.");
  });

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ name: z.string().min(1).max(120) }).parse(d))
  .handler(async () => ({}) as never);

/**
 * Counter-friendly account creation: any signed-in operator (admin or staff) can
 * add a judge/advocate tab on the fly from the manual order dialog.
 */
export const quickAddAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ name: z.string().min(2).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
    ]);
    if (!isAdmin && !isStaff) throw new Error("Staff sign-in required");
    const name = data.name.trim();
    const { data: existing } = await context.supabase
      .from("accounts")
      .select("id,name")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();
    if (existing) return { id: existing.id, name: existing.name, existed: true as const };
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: row, error } = await context.supabase
        .from("accounts")
        .insert({ name, access_code_hash: await codeHash(randomCode()) })
        .select("id,name")
        .single();
      if (!error) return { id: row.id, name: row.name, existed: false as const };
      if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    }
    throw new Error("Could not create the account, try again.");
  });

const _updateAccountReal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        active: z.boolean().optional(),
        credit_limit_cents: z.number().int().min(0).nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("accounts").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const regenerateAccountCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const { error } = await context.supabase
        .from("accounts")
        .update({ access_code_hash: await codeHash(code) })
        .eq("id", data.id);
      if (!error) return { code };
      if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    }
    throw new Error("Could not generate a unique code, try again.");
  });

export const getAccountStatement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ account_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: account, error: aErr } = await context.supabase
      .from("accounts")
      .select(
        "id,name,contact_name,contact_email,contact_phone,credit_limit_cents,notes,active,created_at,updated_at",
      )
      .eq("id", data.account_id)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    const { data: orders, error: oErr } = await context.supabase
      .from("orders")
      .select(
        "id,order_number,total_cents,refunded_cents,subtotal_cents,delivery_fee_cents,customer_name,type,payment_status,status,created_at",
      )
      .eq("account_id", data.account_id)
      .order("created_at", { ascending: false });
    if (oErr) throw new Error(oErr.message);
    const { data: items, error: iErr } = await context.supabase
      .from("order_items")
      .select("order_id,name,qty,unit_price_cents")
      .in(
        "order_id",
        (orders ?? []).map((o) => o.id).length
          ? (orders ?? []).map((o) => o.id)
          : ["00000000-0000-0000-0000-000000000000"],
      );
    if (iErr) throw new Error(iErr.message);
    const { data: payments, error: pErr } = await context.supabase
      .from("account_payments")
      .select("*")
      .eq("account_id", data.account_id)
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);
    return { account, orders: orders ?? [], items: items ?? [], payments: payments ?? [] };
  });

/** Record a part-payment (or full payment) against a house account. */
export const recordAccountPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        account_id: z.string().uuid(),
        amount_cents: z.number().int().positive(),
        method: z.enum(["cash", "card", "bank_transfer", "other"]).default("bank_transfer"),
        reference: z.string().max(120).optional(),
        note: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: row, error } = await context.supabase
      .from("account_payments")
      .insert({
        account_id: data.account_id,
        amount_cents: data.amount_cents,
        method: data.method,
        reference: data.reference || null,
        note: data.note || null,
        recorded_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAccountPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("account_payments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Every order billed to a tab (manual/KDS orders included), with filters for
 * unpaid-only and account/customer name.
 */
export const listTabOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        status: z.enum(["all", "unpaid", "paid"]).default("unpaid"),
        q: z.string().max(120).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("orders")
      .select(
        "id,order_number,account_id,customer_name,company_name,type,source,pos_terminal,payment_method,payment_status,status,total_cents,refunded_cents,created_at",
      )
      .or("account_id.not.is.null,payment_method.eq.account")
      .order("created_at", { ascending: false })
      .limit(400);
    if (data.status === "unpaid") query = query.eq("payment_status", "on_account");
    if (data.status === "paid") query = query.neq("payment_status", "on_account");
    const { data: orders, error } = await query;
    if (error) throw new Error(error.message);

    const ids = (orders ?? []).map((o) => o.id);
    const { data: items } = ids.length
      ? await context.supabase
          .from("order_items")
          .select("order_id,name,qty,unit_price_cents,notes")
          .in("order_id", ids)
      : { data: [] as { order_id: string; name: string; qty: number; unit_price_cents: number; notes: string | null }[] };
    const { data: accounts } = await context.supabase.from("accounts").select("id,name");
    const nameById = new Map((accounts ?? []).map((a) => [a.id, a.name]));

    const term = (data.q ?? "").trim().toLowerCase();
    const rows = (orders ?? [])
      .map((o) => ({
        ...o,
        account_name: o.account_id ? (nameById.get(o.account_id) ?? null) : null,
        due_cents: Math.max(0, o.total_cents - o.refunded_cents),
        items: (items ?? []).filter((i) => i.order_id === o.id),
      }))
      .filter(
        (o) =>
          !term ||
          (o.account_name ?? "").toLowerCase().includes(term) ||
          o.customer_name.toLowerCase().includes(term) ||
          (o.company_name ?? "").toLowerCase().includes(term) ||
          String(o.order_number).includes(term),
      );
    return {
      rows,
      total_due_cents: rows
        .filter((r) => r.payment_status === "on_account")
        .reduce((s, r) => s + r.due_cents, 0),
    };
  });

/** Mark selected tab orders as fully paid, stamped with the payment time. */
export const markTabOrdersPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        order_ids: z.array(z.string().uuid()).min(1).max(200),
        method: z.enum(["cash", "card", "bank_transfer", "other"]).default("bank_transfer"),
        reference: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const paidAt = new Date().toISOString();
    const { data: orders, error: oErr } = await context.supabase
      .from("orders")
      .select("id,order_number,account_id,total_cents,refunded_cents")
      .in("id", data.order_ids)
      .eq("payment_status", "on_account");
    if (oErr) throw new Error(oErr.message);
    if (!orders?.length) return { ok: true, paid_at: paidAt, count: 0 };

    const { error } = await context.supabase
      .from("orders")
      .update({ payment_status: "paid" })
      .in(
        "id",
        orders.map((o) => o.id),
      )
      .eq("payment_status", "on_account");
    if (error) throw new Error(error.message);

    // Keep a dated receipt line per account. settled_at is stamped so the row
    // is history only and does not double-count against the balance.
    const byAccount = new Map<string, { amount: number; numbers: number[] }>();
    for (const o of orders) {
      if (!o.account_id) continue;
      const entry = byAccount.get(o.account_id) ?? { amount: 0, numbers: [] };
      entry.amount += Math.max(0, o.total_cents - o.refunded_cents);
      entry.numbers.push(o.order_number);
      byAccount.set(o.account_id, entry);
    }
    if (byAccount.size) {
      const { error: pErr } = await context.supabase.from("account_payments").insert(
        [...byAccount].map(([account_id, entry]) => ({
          account_id,
          amount_cents: entry.amount,
          method: data.method,
          reference: data.reference || null,
          note: `Paid in full: orders ${entry.numbers.map((n) => `#${n}`).join(", ")}`,
          recorded_by: context.userId,
          settled_at: paidAt,
        })),
      );
      if (pErr) throw new Error(pErr.message);
    }
    return { ok: true, paid_at: paidAt, count: orders.length };
  });

/** Mark all currently-on-tab orders for an account as paid (settlement). */
export const settleAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ account_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("account_id", data.account_id)
      .eq("payment_status", "on_account");
    if (error) throw new Error(error.message);
    // Roll any recorded part-payments into this settlement so they stop
    // counting against the (now zero) balance, while staying in history.
    const { error: pErr } = await context.supabase
      .from("account_payments")
      .update({ settled_at: new Date().toISOString() })
      .eq("account_id", data.account_id)
      .is("settled_at", null);
    if (pErr) throw new Error(pErr.message);
    return { ok: true };
  });
