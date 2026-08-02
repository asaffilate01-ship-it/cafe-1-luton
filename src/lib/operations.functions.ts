import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callOperationsRpc } from "./ops-rpc";

export type OperationsDashboard = {
  site: { id: string; name: string; legal_name: string; code: string } | null;
  checklists: Array<{
    id: string;
    cadence: string;
    title: string;
    description: string | null;
    sort_order: number;
    completed: boolean;
    completed_at: string | null;
    note: string | null;
  }>;
  summary: DailyControlSummary | null;
  open_shifts: Array<{
    id: string;
    terminal: string;
    opening_float_cents: number;
    staff_id: string;
    opened_at: string;
  }>;
  low_stock_count: number;
  unresolved_alerts: number;
  today: {
    orders: number;
    net_sales_cents: number;
    refunds_cents: number;
    cash_variance_cents: number;
  };
};

export type DailyControlSummary = {
  id: string;
  site_id: string;
  business_date: string;
  gross_sales_cents: number;
  net_sales_cents: number;
  cash_sales_cents: number;
  card_sales_cents: number;
  account_sales_cents: number;
  voucher_cents: number;
  discounts_cents: number;
  refunds_cents: number;
  waste_value_cents: number;
  till_variance_cents: number;
  order_count: number;
  generated_at: string;
};

const DashboardInput = z.object({
  site_id: z.string().uuid(),
  business_date: z.string().date(),
});

export const getOperationsDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => DashboardInput.parse(value))
  .handler(({ data, context }) =>
    callOperationsRpc<OperationsDashboard>(context.supabase, "cafe1_operations_dashboard", {
      _site_id: data.site_id,
      _business_date: data.business_date,
    }),
  );

export const completeOperationsChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        checklist_id: z.string().uuid(),
        business_date: z.string().date(),
        note: z.string().max(300).default(""),
      })
      .parse(value),
  )
  .handler(({ data, context }) =>
    callOperationsRpc<{ id: string }>(context.supabase, "cafe1_complete_checklist", {
      _checklist_id: data.checklist_id,
      _business_date: data.business_date,
      _note: data.note,
    }),
  );

export const generateDailyControlSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => DashboardInput.parse(value))
  .handler(async ({ data, context }) => {
    const { requireManagerMfa } = await import("./elevated-auth.server");
    requireManagerMfa(context.claims);
    return callOperationsRpc<DailyControlSummary>(
      context.supabase,
      "cafe1_generate_daily_summary",
      { _site_id: data.site_id, _business_date: data.business_date },
    );
  });
