import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callOperationsRpc } from "./ops-rpc";

export type TenantStatus = "trial" | "active" | "suspended" | "cancelled";

export type TenantPlan = {
  id: string;
  code: string;
  name: string;
  monthly_price_cents: number;
  included_orders: number;
  max_sites: number;
  features: string[];
  active: boolean;
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  legal_name: string;
  primary_domain: string | null;
  deployment_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: TenantStatus;
  plan_code: string | null;
  brand_primary: string;
  brand_accent: string;
  logo_url: string | null;
  is_self: boolean;
  trial_ends_on: string | null;
  notes: string | null;
  created_at: string;
  orders_30d: number;
  revenue_30d_cents: number;
  last_report_on: string | null;
  outstanding_cents: number;
};

export type TenantInvoice = {
  id: string;
  tenant_id: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  status: "draft" | "sent" | "paid" | "void";
  paid_on: string | null;
  reference: string | null;
};

export type LandlordDashboard = {
  plans: TenantPlan[];
  tenants: Tenant[];
  invoices: TenantInvoice[];
  totals: {
    tenants: number;
    active: number;
    suspended: number;
    mrr_cents: number;
    outstanding_cents: number;
    orders_30d: number;
    revenue_30d_cents: number;
  };
};

const TenantSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/i, "Use letters, numbers and hyphens only"),
  name: z.string().trim().min(2).max(120),
  legal_name: z.string().trim().max(160).default(""),
  primary_domain: z.string().trim().max(120).optional(),
  deployment_url: z.string().trim().max(200).optional(),
  contact_name: z.string().trim().max(120).optional(),
  contact_email: z.string().trim().email().max(160).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(40).optional(),
  status: z.enum(["trial", "active", "suspended", "cancelled"]).default("trial"),
  plan_code: z.string().trim().max(40).optional(),
  brand_primary: z.string().trim().max(24).default("#C81E1E"),
  brand_accent: z.string().trim().max(24).default("#FFFFFF"),
  logo_url: z.string().trim().max(400).optional(),
  trial_ends_on: z.string().trim().max(10).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const PlanSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_-]+$/i),
  name: z.string().trim().min(2).max(80),
  monthly_price_cents: z.number().int().min(0).max(10_000_000),
  included_orders: z.number().int().min(0).max(10_000_000),
  max_sites: z.number().int().min(1).max(500),
  features: z.array(z.string().trim().max(120)).max(30).default([]),
  active: z.boolean().default(true),
});

const InvoiceSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  period_start: z.string().min(10).max(10),
  period_end: z.string().min(10).max(10),
  amount_cents: z.number().int().min(0).max(100_000_000),
  status: z.enum(["draft", "sent", "paid", "void"]).default("draft"),
  reference: z.string().trim().max(80).optional(),
});

/** True when the signed-in user is a landlord (SaaS operator) admin. */
export const getLandlordAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isLandlord } = await context.supabase.rpc("cafe1_is_landlord", {
      _user_id: context.userId,
    } as never);
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isLandlord: Boolean(isLandlord), isAdmin: Boolean(isAdmin) };
  });

/** One-time bootstrap: the first admin becomes the landlord operator. */
export const claimLandlord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => callOperationsRpc<boolean>(context.supabase, "cafe1_claim_landlord"));

export const getLandlordDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    callOperationsRpc<LandlordDashboard>(context.supabase, "cafe1_landlord_dashboard"),
  );

export const saveTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => TenantSchema.parse(value))
  .handler(({ data, context }) =>
    callOperationsRpc<Tenant>(context.supabase, "cafe1_save_tenant", { _payload: data }),
  );

export const setTenantStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        tenant_id: z.string().uuid(),
        status: z.enum(["trial", "active", "suspended", "cancelled"]),
      })
      .parse(value),
  )
  .handler(({ data, context }) =>
    callOperationsRpc<Tenant>(context.supabase, "cafe1_set_tenant_status", {
      _tenant_id: data.tenant_id,
      _status: data.status,
    }),
  );

/** Reveals (or rotates) the key a tenant deployment uses to report metrics back. */
export const revealTenantKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z.object({ tenant_id: z.string().uuid(), rotate: z.boolean().default(false) }).parse(value),
  )
  .handler(async ({ data, context }) => {
    const { requireManagerMfa } = await import("./elevated-auth.server");
    requireManagerMfa(context.claims);
    return callOperationsRpc<string>(context.supabase, "cafe1_reveal_tenant_key", {
      _tenant_id: data.tenant_id,
      _rotate: data.rotate,
    });
  });

export const saveTenantPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => PlanSchema.parse(value))
  .handler(({ data, context }) =>
    callOperationsRpc<TenantPlan>(context.supabase, "cafe1_save_tenant_plan", { _payload: data }),
  );

export const saveTenantInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => InvoiceSchema.parse(value))
  .handler(({ data, context }) =>
    callOperationsRpc<TenantInvoice>(context.supabase, "cafe1_save_tenant_invoice", {
      _payload: data,
    }),
  );
