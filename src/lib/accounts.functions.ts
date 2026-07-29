import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Public: verify a tab access code — returns account id + name, or null. */
export const verifyTabCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(3).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("verify_account_code", { _code: data.code.trim() });
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0];
    if (!row) return { ok: false as const };
    return { ok: true as const, account_id: row.id, name: row.name, code: data.code.trim().toUpperCase() };
  });

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: accounts, error } = await context.supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: orders } = await context.supabase
      .from("orders")
      .select("account_id,total_cents,payment_status")
      .not("account_id", "is", null);
    const { data: payments } = await context.supabase
      .from("account_payments")
      .select("account_id,amount_cents")
      .is("settled_at", null);
    const bal = new Map<string, number>();
    for (const o of orders ?? []) {
      if (o.payment_status === "on_account" && o.account_id)
        bal.set(o.account_id, (bal.get(o.account_id) ?? 0) + o.total_cents);
    }
    for (const p of payments ?? []) {
      bal.set(p.account_id, (bal.get(p.account_id) ?? 0) - p.amount_cents);
    }
    return (accounts ?? []).map((a) => ({
      ...a,
      outstanding_cents: Math.max(bal.get(a.id) ?? 0, 0),
    }));
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    name: z.string().min(1).max(120),
    contact_name: z.string().max(120).optional(),
    contact_email: z.string().email().optional().or(z.literal("")),
    contact_phone: z.string().max(30).optional(),
    credit_limit_cents: z.number().int().min(0).optional(),
    notes: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
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
          access_code: code,
        })
        .select()
        .single();
      if (!error) return row;
      if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    }
    throw new Error("Could not generate a unique access code, try again.");
  });

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    active: z.boolean().optional(),
    credit_limit_cents: z.number().int().min(0).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("accounts").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const regenerateAccountCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const { error } = await context.supabase.from("accounts").update({ access_code: code }).eq("id", data.id);
      if (!error) return { code };
      if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    }
    throw new Error("Could not generate a unique code, try again.");
  });

export const getAccountStatement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ account_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: account, error: aErr } = await context.supabase
      .from("accounts").select("*").eq("id", data.account_id).maybeSingle();
    if (aErr) throw new Error(aErr.message);
    const { data: orders, error: oErr } = await context.supabase
      .from("orders")
      .select("id,order_number,total_cents,subtotal_cents,delivery_fee_cents,customer_name,type,payment_status,status,created_at")
      .eq("account_id", data.account_id)
      .order("created_at", { ascending: false });
    if (oErr) throw new Error(oErr.message);
    const { data: items, error: iErr } = await context.supabase
      .from("order_items")
      .select("order_id,name,qty,unit_price_cents")
      .in("order_id", (orders ?? []).map((o) => o.id).length ? (orders ?? []).map((o) => o.id) : ["00000000-0000-0000-0000-000000000000"]);
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
  .inputValidator((d: unknown) => z.object({
    account_id: z.string().uuid(),
    amount_cents: z.number().int().positive(),
    method: z.enum(["cash", "card", "bank_transfer", "other"]).default("bank_transfer"),
    reference: z.string().max(120).optional(),
    note: z.string().max(300).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
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
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("account_payments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Mark all currently-on-tab orders for an account as paid (settlement). */
export const settleAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ account_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
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