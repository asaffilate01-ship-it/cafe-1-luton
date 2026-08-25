import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  CircleDollarSign,
  Copy,
  KeyRound,
  Loader2,
  Pause,
  Play,
  Plus,
  ReceiptText,
  Save,
  Store,
  TrendingUp,
} from "lucide-react";
import { RequireRole } from "@/components/require-role";
import { AdminNav } from "@/components/admin-nav";
import {
  claimLandlord,
  getLandlordAccess,
  getLandlordDashboard,
  revealTenantKey,
  saveTenant,
  saveTenantInvoice,
  setTenantStatus,
  type LandlordDashboard,
  type Tenant,
} from "@/lib/landlord.functions";

export const Route = createFileRoute("/landlord")({
  head: () => ({
    meta: [
      { title: "Landlord control centre — Cafe 1 SaaS" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Manage tenant businesses, plans and SaaS billing." },
    ],
  }),
  component: () => (
    <RequireRole roles={["admin"]} next="/landlord">
      <LandlordPage />
    </RequireRole>
  ),
});

const money = (cents: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format((cents ?? 0) / 100);

type TenantForm = {
  id?: string;
  slug: string;
  name: string;
  legal_name: string;
  primary_domain: string;
  deployment_url: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  status: Tenant["status"];
  plan_code: string;
  brand_primary: string;
  brand_accent: string;
  notes: string;
};

const EMPTY_TENANT: TenantForm = {
  slug: "",
  name: "",
  legal_name: "",
  primary_domain: "",
  deployment_url: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  status: "trial",
  plan_code: "starter",
  brand_primary: "#C81E1E",
  brand_accent: "#FFFFFF",
  notes: "",
};

function LandlordPage() {
  const access = useServerFn(getLandlordAccess);
  const claim = useServerFn(claimLandlord);
  const load = useServerFn(getLandlordDashboard);
  const persist = useServerFn(saveTenant);
  const setStatus = useServerFn(setTenantStatus);
  const revealKey = useServerFn(revealTenantKey);
  const persistInvoice = useServerFn(saveTenantInvoice);

  const [isLandlord, setIsLandlord] = useState<boolean | null>(null);
  const [data, setData] = useState<LandlordDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<TenantForm>(EMPTY_TENANT);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const who = await access();
      setIsLandlord(who.isLandlord);
      if (who.isLandlord) setData(await load());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the landlord dashboard");
    } finally {
      setLoading(false);
    }
  }, [access, load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onClaim() {
    setBusy(true);
    try {
      await claim();
      toast.success("Landlord access granted to your account");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not claim landlord access");
    } finally {
      setBusy(false);
    }
  }

  async function submitTenant(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await persist({ data: { ...form, contact_email: form.contact_email || undefined } });
      toast.success(form.id ? "Tenant updated" : "Tenant created");
      setForm(EMPTY_TENANT);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save tenant");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuspend(tenant: Tenant) {
    try {
      await setStatus({
        data: {
          tenant_id: tenant.id,
          status: tenant.status === "suspended" ? "active" : "suspended",
        },
      });
      toast.success(tenant.status === "suspended" ? "Tenant reactivated" : "Tenant suspended");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change tenant status");
    }
  }

  async function copyKey(tenant: Tenant, rotate: boolean) {
    try {
      const key = await revealKey({ data: { tenant_id: tenant.id, rotate } });
      await navigator.clipboard?.writeText(key);
      toast.success(rotate ? "New reporting key copied" : "Reporting key copied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the reporting key");
    }
  }

  async function raiseInvoice(tenant: Tenant) {
    const plan = data?.plans.find((p) => p.code === tenant.plan_code);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    try {
      await persistInvoice({
        data: {
          tenant_id: tenant.id,
          period_start: start.toISOString().slice(0, 10),
          period_end: end.toISOString().slice(0, 10),
          amount_cents: plan?.monthly_price_cents ?? 0,
          status: "sent",
          reference: `${tenant.slug}-${start.toISOString().slice(0, 7)}`,
        },
      });
      toast.success("Invoice raised");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not raise the invoice");
    }
  }

  async function markPaid(invoiceId: string, tenantId: string) {
    try {
      await persistInvoice({
        data: {
          id: invoiceId,
          tenant_id: tenantId,
          period_start: "1970-01-01",
          period_end: "1970-01-01",
          amount_cents: 0,
          status: "paid",
        },
      });
      toast.success("Invoice marked paid");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the invoice");
    }
  }

  const tenantsById = useMemo(
    () => new Map((data?.tenants ?? []).map((t) => [t.id, t])),
    [data?.tenants],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminNav />
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isLandlord) {
    return (
      <div className="min-h-screen bg-background">
        <AdminNav />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Building2 className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold">Landlord control centre</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area manages the businesses that licence this ordering platform. The first admin to
            claim it becomes the operator; after that, access is granted by an existing landlord.
          </p>
          <button
            onClick={onClaim}
            disabled={busy}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Claim landlord access
          </button>
        </main>
      </div>
    );
  }

  const totals = data?.totals;

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">
          Tenant &amp; landlord
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">Landlord control centre</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cafe 1 Luton is tenant one. Every duplicated deployment reports back here for billing
          and cross-tenant reporting.
        </p>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={<Store className="h-4 w-4" />}
            label="Tenants"
            value={`${totals?.active ?? 0} active`}
            hint={`${totals?.tenants ?? 0} total · ${totals?.suspended ?? 0} suspended`}
          />
          <Stat
            icon={<CircleDollarSign className="h-4 w-4" />}
            label="Monthly recurring"
            value={money(totals?.mrr_cents ?? 0)}
            hint="From active tenants on a plan"
          />
          <Stat
            icon={<ReceiptText className="h-4 w-4" />}
            label="Outstanding"
            value={money(totals?.outstanding_cents ?? 0)}
            hint="Draft and sent invoices"
          />
          <Stat
            icon={<TrendingUp className="h-4 w-4" />}
            label="Orders (30 days)"
            value={String(totals?.orders_30d ?? 0)}
            hint={`${money(totals?.revenue_30d_cents ?? 0)} across all tenants`}
          />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold">Tenants</h2>
            {(data?.tenants ?? []).map((tenant) => (
              <article
                key={tenant.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: tenant.brand_primary }}
                        aria-hidden
                      />
                      <h3 className="font-display text-lg font-bold">{tenant.name}</h3>
                      <StatusPill status={tenant.status} />
                      {tenant.is_self && (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                          This deployment
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {tenant.primary_domain ?? "no domain yet"} · plan{" "}
                      {tenant.plan_code ?? "unassigned"} · {tenant.contact_email ?? "no contact"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tenant.orders_30d} orders / {money(tenant.revenue_30d_cents)} in 30 days ·
                      last report {tenant.last_report_on ?? "never"} · outstanding{" "}
                      {money(tenant.outstanding_cents)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Action onClick={() => setForm({ ...EMPTY_TENANT, ...toForm(tenant) })}>
                      <Save className="h-3.5 w-3.5" /> Edit
                    </Action>
                    <Action onClick={() => void toggleSuspend(tenant)}>
                      {tenant.status === "suspended" ? (
                        <>
                          <Play className="h-3.5 w-3.5" /> Reactivate
                        </>
                      ) : (
                        <>
                          <Pause className="h-3.5 w-3.5" /> Suspend
                        </>
                      )}
                    </Action>
                    <Action onClick={() => void copyKey(tenant, false)}>
                      <Copy className="h-3.5 w-3.5" /> Copy key
                    </Action>
                    <Action onClick={() => void copyKey(tenant, true)}>
                      <KeyRound className="h-3.5 w-3.5" /> Rotate
                    </Action>
                    <Action onClick={() => void raiseInvoice(tenant)}>
                      <ReceiptText className="h-3.5 w-3.5" /> Raise invoice
                    </Action>
                  </div>
                </div>
              </article>
            ))}
            {(data?.tenants ?? []).length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No tenants yet. Add your first business on the right.
              </p>
            )}

            <h2 className="pt-4 font-display text-xl font-bold">Billing</h2>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Tenant</th>
                    <th className="p-3 text-left">Period</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {(data?.invoices ?? []).map((invoice) => (
                    <tr key={invoice.id} className="border-t border-border">
                      <td className="p-3">{tenantsById.get(invoice.tenant_id)?.name ?? "—"}</td>
                      <td className="p-3">
                        {invoice.period_start} → {invoice.period_end}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {money(invoice.amount_cents)}
                      </td>
                      <td className="p-3 capitalize">{invoice.status}</td>
                      <td className="p-3 text-right">
                        {invoice.status !== "paid" && (
                          <Action onClick={() => void markPaid(invoice.id, invoice.tenant_id)}>
                            Mark paid
                          </Action>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(data?.invoices ?? []).length === 0 && (
                    <tr>
                      <td className="p-4 text-muted-foreground" colSpan={5}>
                        No invoices raised yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="pt-4 font-display text-xl font-bold">Plans</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {(data?.plans ?? []).map((plan) => (
                <div key={plan.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-display text-lg font-bold">{plan.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {money(plan.monthly_price_cents)}/month · {plan.included_orders} orders ·{" "}
                    {plan.max_sites} site{plan.max_sites === 1 ? "" : "s"}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {(plan.features ?? []).map((feature) => (
                      <li key={feature}>• {feature}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <form
            onSubmit={submitTenant}
            className="h-fit rounded-2xl border border-border bg-card p-5"
          >
            <h2 className="font-display text-xl font-bold">
              {form.id ? "Edit tenant" : "New tenant"}
            </h2>
            <div className="mt-4 grid gap-3">
              <Field
                label="Slug"
                value={form.slug}
                onChange={(v) => setForm({ ...form, slug: v })}
                required
              />
              <Field
                label="Business name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                required
              />
              <Field
                label="Legal company name"
                value={form.legal_name}
                onChange={(v) => setForm({ ...form, legal_name: v })}
              />
              <Field
                label="Primary domain"
                value={form.primary_domain}
                onChange={(v) => setForm({ ...form, primary_domain: v })}
              />
              <Field
                label="Deployment URL"
                value={form.deployment_url}
                onChange={(v) => setForm({ ...form, deployment_url: v })}
              />
              <Field
                label="Contact name"
                value={form.contact_name}
                onChange={(v) => setForm({ ...form, contact_name: v })}
              />
              <Field
                label="Contact email"
                type="email"
                value={form.contact_email}
                onChange={(v) => setForm({ ...form, contact_email: v })}
              />
              <Field
                label="Contact phone"
                value={form.contact_phone}
                onChange={(v) => setForm({ ...form, contact_phone: v })}
              />
              <label className="text-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Plan
                </span>
                <select
                  value={form.plan_code}
                  onChange={(e) => setForm({ ...form, plan_code: e.target.value })}
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3"
                >
                  {(data?.plans ?? []).map((plan) => (
                    <option key={plan.code} value={plan.code}>
                      {plan.name} — {money(plan.monthly_price_cents)}/mo
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Status
                </span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as TenantForm["status"] })
                  }
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3"
                >
                  {(["trial", "active", "suspended", "cancelled"] as const).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Brand colour"
                  type="color"
                  value={form.brand_primary}
                  onChange={(v) => setForm({ ...form, brand_primary: v })}
                />
                <Field
                  label="Accent"
                  type="color"
                  value={form.brand_accent}
                  onChange={(v) => setForm({ ...form, brand_accent: v })}
                />
              </div>
              <label className="text-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Notes
                </span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-3"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                disabled={busy}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Save tenant
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={() => setForm(EMPTY_TENANT)}
                  className="h-11 rounded-xl border border-border px-4 font-semibold"
                >
                  New
                </button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function toForm(tenant: Tenant): TenantForm {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    legal_name: tenant.legal_name ?? "",
    primary_domain: tenant.primary_domain ?? "",
    deployment_url: tenant.deployment_url ?? "",
    contact_name: tenant.contact_name ?? "",
    contact_email: tenant.contact_email ?? "",
    contact_phone: tenant.contact_phone ?? "",
    status: tenant.status,
    plan_code: tenant.plan_code ?? "starter",
    brand_primary: tenant.brand_primary,
    brand_accent: tenant.brand_accent,
    notes: tenant.notes ?? "",
  };
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function StatusPill({ status }: { status: Tenant["status"] }) {
  const tone =
    status === "active"
      ? "bg-emerald-100 text-emerald-800"
      : status === "suspended"
        ? "bg-destructive/10 text-destructive"
        : status === "cancelled"
          ? "bg-muted text-muted-foreground"
          : "bg-amber-100 text-amber-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${tone}`}>
      {status}
    </span>
  );
}

function Action({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:border-primary"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3"
      />
    </label>
  );
}
