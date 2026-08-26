import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callOperationsRpc } from "./ops-rpc";

export const EXPENSE_CATEGORIES = [
  "rent_rates",
  "utilities",
  "wages",
  "insurance",
  "professional_fees",
  "marketing",
  "repairs",
  "cleaning",
  "software",
  "bank_fees",
  "payment_fees",
  "travel_delivery",
  "supplies",
  "smallwares",
  "other",
] as const;
export const PAYMENT_METHODS = [
  "cash",
  "card",
  "bank_transfer",
  "direct_debit",
  "sumup_card",
  "other",
] as const;

const Category = z.enum(EXPENSE_CATEGORIES);
const PaymentMethod = z.enum(PAYMENT_METHODS);
const SitePeriod = z.object({
  site_id: z.string().uuid(),
  from_date: z.string().date(),
  to_date: z.string().date(),
});

export type FinanceDashboard = {
  from_date: string;
  to_date: string;
  site: { id: string; name: string; legal_name: string; trading_name: string } | null;
  sales_income_cents: number;
  customer_income_cents: number;
  voucher_income_cents: number;
  refunds_cents: number;
  discounts_cents: number;
  delivery_fees_cents: number;
  order_count: number;
  average_order_cents: number;
  cogs_cents: number;
  gross_profit_cents: number;
  operating_expenses_cents: number;
  payment_fees_cents: number;
  operating_profit_cents: number;
  gross_margin_percent: number;
  food_cost_percent: number;
  operating_margin_percent: number;
  refund_rate_percent: number;
  purchase_outflow_cents: number;
  stock_value_cents: number;
  low_stock_count: number;
  waste_cents: number;
  staff_meal_cents: number;
  stock_variance_cents: number;
  zero_cost_lines: number;
  sold_lines: number;
  payment_mix: Record<string, number>;
  sumup: { paid_out_cents: number; deductions_cents: number; fees_cents: number };
  expense_categories: Array<{ category: string; amount_cents: number; count: number }>;
  daily: Array<{ date: string; income_cents: number; orders: number; expenses_cents: number }>;
  recent_expenses: Array<{
    id: string;
    expense_date: string;
    category: string;
    description: string;
    amount_cents: number;
    tax_included_cents: number;
    payment_method: string;
    source: string;
    invoice_reference: string | null;
    receipt_reference: string | null;
    supplier_name: string | null;
    created_at: string;
  }>;
  recent_purchases: Array<{
    id: string;
    invoice_date: string;
    invoice_number: string | null;
    total_cost_cents: number;
    payment_status: string;
    payment_method: string;
    received_at: string;
    supplier_name: string | null;
    line_count: number;
  }>;
  suppliers: Array<{
    id: string;
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    account_reference: string | null;
    active: boolean;
  }>;
};

export const getFinanceDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => SitePeriod.parse(value))
  .handler(async ({ data, context }) => {
    return callOperationsRpc<FinanceDashboard>(context.supabase, "cafe1_finance_dashboard", {
      _site_id: data.site_id,
      _from_date: data.from_date,
      _to_date: data.to_date,
    });
  });

export const saveExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        site_id: z.string().uuid(),
        expense_date: z.string().date(),
        category: Category,
        supplier_id: z.string().uuid().optional(),
        description: z.string().trim().min(2).max(300),
        amount_cents: z.number().int().positive().max(100_000_000),
        tax_included_cents: z.number().int().min(0).max(100_000_000).default(0),
        payment_method: PaymentMethod,
        invoice_reference: z.string().trim().max(100).optional(),
        receipt_reference: z.string().trim().max(300).optional(),
        notes: z.string().trim().max(500).optional(),
      })
      .refine(
        (row) => row.tax_included_cents <= row.amount_cents,
        "Tax included cannot exceed the expense",
      )
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    const { site_id, ...payload } = data;
    return callOperationsRpc<{ id: string }>(context.supabase, "cafe1_save_expense", {
      _site_id: site_id,
      _payload: payload,
    });
  });

export const voidExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({ expense_id: z.string().uuid(), reason: z.string().trim().min(4).max(300) })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    return callOperationsRpc<{ id: string }>(context.supabase, "cafe1_void_expense", {
      _expense_id: data.expense_id,
      _reason: data.reason,
    });
  });

export const saveSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        site_id: z.string().uuid(),
        name: z.string().trim().min(2).max(160),
        contact_name: z.string().trim().max(160).optional(),
        email: z.string().trim().email().max(200).or(z.literal("")).optional(),
        phone: z.string().trim().max(40).optional(),
        account_reference: z.string().trim().max(100).optional(),
        lead_days: z.number().int().min(0).max(365).default(0),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    const { site_id, ...payload } = data;
    return callOperationsRpc<{ id: string; name: string }>(
      context.supabase,
      "cafe1_save_supplier",
      { _site_id: site_id, _payload: payload },
    );
  });

export const receivePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        site_id: z.string().uuid(),
        supplier_id: z.string().uuid(),
        invoice_number: z.string().trim().max(100).optional(),
        supplier_reference: z.string().trim().max(100).optional(),
        invoice_date: z.string().date(),
        delivery_cost_cents: z.number().int().min(0).max(10_000_000).default(0),
        discount_cents: z.number().int().min(0).max(10_000_000).default(0),
        payment_method: PaymentMethod,
        payment_status: z.enum(["unpaid", "paid"]),
        note: z.string().trim().max(500).optional(),
        lines: z
          .array(
            z.object({
              inventory_item_id: z.string().uuid(),
              quantity: z.number().positive().max(1_000_000),
              unit_cost_cents: z.number().min(0).max(10_000_000),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    const { site_id, ...payload } = data;
    return callOperationsRpc<{ id: string; line_count: number }>(
      context.supabase,
      "cafe1_receive_purchase",
      { _site_id: site_id, _payload: payload },
    );
  });

const ImportedExpense = z.object({
  expense_date: z.string().date(),
  category: Category,
  description: z.string().trim().min(2).max(300),
  amount_cents: z.number().int().positive().max(100_000_000),
  tax_included_cents: z.number().int().min(0).max(100_000_000),
  payment_method: PaymentMethod,
  provider_reference: z.string().trim().min(5).max(500),
  invoice_reference: z.string().trim().max(100),
  notes: z.string().trim().max(500),
});

export const importSumupExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({ site_id: z.string().uuid(), rows: z.array(ImportedExpense).min(1).max(1000) })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    return callOperationsRpc<{ imported: number; skipped: number }>(
      context.supabase,
      "cafe1_import_sumup_expenses",
      { _site_id: data.site_id, _rows: data.rows },
    );
  });

type SumUpPayout = {
  id: number | string;
  type: string;
  amount: number;
  date: string;
  currency: string;
  fee: number;
  status: string;
  reference?: string;
  transaction_code?: string;
};

export const syncSumupSettlements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => SitePeriod.parse(value))
  .handler(async ({ data, context }) => {
    const key = process.env.SUMUP_API_KEY;
    const merchant = process.env.SUMUP_MERCHANT_CODE;
    if (!key || !merchant) throw new Error("SUMUP_API_KEY and SUMUP_MERCHANT_CODE are required");
    const params = new URLSearchParams({
      start_date: data.from_date,
      end_date: data.to_date,
      format: "json",
      limit: "9999",
      order: "desc",
    });
    const response = await fetch(
      `https://api.sumup.com/v1.0/merchants/${encodeURIComponent(merchant)}/payouts?${params}`,
      {
        headers: { Authorization: `Bearer ${key}` },
      },
    );
    if (!response.ok) {
      const body = (await response.text()).slice(0, 240);
      throw new Error(
        `SumUp payout sync failed (${response.status}). Confirm the payouts.read scope. ${body}`,
      );
    }
    const payload = (await response.json()) as SumUpPayout[];
    const allowedTypes = new Set([
      "PAYOUT",
      "CHARGE_BACK_DEDUCTION",
      "REFUND_DEDUCTION",
      "DD_RETURN_DEDUCTION",
      "BALANCE_DEDUCTION",
    ]);
    const rows = payload
      .filter(
        (row) =>
          row.currency === "GBP" &&
          allowedTypes.has(row.type) &&
          ["SUCCESSFUL", "FAILED"].includes(row.status),
      )
      .map((row) => ({
        provider_id: String(row.id),
        settlement_date: row.date,
        settlement_type: row.type,
        status: row.status,
        amount_cents: Math.round(Number(row.amount) * 100),
        fee_cents: Math.max(0, Math.round(Number(row.fee ?? 0) * 100)),
        currency: "GBP",
        provider_reference: row.reference ?? "",
        transaction_code: row.transaction_code ?? "",
      }));
    return callOperationsRpc<{ records: number; fee_cents: number }>(
      context.supabase,
      "cafe1_import_sumup_settlements",
      { _site_id: data.site_id, _rows: rows },
    );
  });
