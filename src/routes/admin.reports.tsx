import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgePoundSterling,
  BarChart3,
  Boxes,
  Download,
  FileUp,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Store,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { AdminNav } from "@/components/admin-nav";
import { AdminMfaCard } from "@/components/admin-mfa-card";
import { RequireRole } from "@/components/require-role";
import { SiteSwitcher } from "@/components/site-switcher";
import { useSites } from "@/hooks/use-sites";
import { money } from "@/lib/format";
import { askPrompt } from "@/lib/confirm";
import { getInventoryDashboard, type InventoryItem } from "@/lib/inventory.functions";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  getFinanceDashboard,
  importSumupExpenses,
  receivePurchase,
  saveExpense,
  saveSupplier,
  syncSumupSettlements,
  voidExpense,
  type FinanceDashboard,
} from "@/lib/finance.functions";
import { parseSumupExpenseCsv } from "@/lib/expense-import";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Financials & KPIs — Cafe1" },
      {
        name: "description",
        content: "Manager KPIs, P&L, expenses, stock purchases and SumUp reconciliation.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireRole roles={["admin"]} next="/admin/reports">
      <FinancePage />
    </RequireRole>
  ),
});

type Section = "overview" | "expenses" | "purchases" | "sumup";
type PurchaseLine = { inventory_item_id: string; quantity: string; unit_cost: string };

const CATEGORY_LABELS: Record<string, string> = {
  rent_rates: "Rent & rates",
  utilities: "Utilities",
  wages: "Wages",
  insurance: "Insurance",
  professional_fees: "Professional fees",
  marketing: "Marketing",
  repairs: "Repairs & maintenance",
  cleaning: "Cleaning",
  software: "Software",
  bank_fees: "Bank fees",
  payment_fees: "Payment fees",
  travel_delivery: "Travel & delivery",
  supplies: "Non-stock supplies",
  smallwares: "Smallwares",
  other: "Other",
};
const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  direct_debit: "Direct debit",
  sumup_card: "SumUp card",
  other: "Other",
};

function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
function startFor(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days + 1);
  return isoDate(date);
}
function poundsToPence(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}
function percent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}
function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
function download(name: string, lines: Array<Array<unknown>>) {
  const csv = lines.map((row) => row.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function FinancePage() {
  const { sites, siteId, setSiteId, loading: sitesLoading, error: sitesError } = useSites();
  const loadFinance = useServerFn(getFinanceDashboard);
  const loadInventory = useServerFn(getInventoryDashboard);
  const postExpense = useServerFn(saveExpense);
  const postSupplier = useServerFn(saveSupplier);
  const postPurchase = useServerFn(receivePurchase);
  const postImport = useServerFn(importSumupExpenses);
  const postSync = useServerFn(syncSumupSettlements);
  const postVoid = useServerFn(voidExpense);
  const fileInput = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<Section>("overview");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<FinanceDashboard | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fromDate = useMemo(() => startFor(days), [days]);
  const toDate = isoDate();

  const refresh = useCallback(async () => {
    if (!siteId) return;

    setLoading(true);
    try {
      const [finance, stock] = await Promise.all([
        loadFinance({ data: { site_id: siteId, from_date: fromDate, to_date: toDate } }),
        loadInventory({ data: { site_id: siteId } }),
      ]);
      setData(finance);
      setInventory(stock.items.filter((item) => item.active));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load financials");
    } finally {
      setLoading(false);
    }
  }, [siteId, fromDate, toDate, loadFinance, loadInventory]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await task();
      toast.success(success);
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The action failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleExpenseCsv(file: File) {
    try {
      const rows = parseSumupExpenseCsv(await file.text());
      await run(async () => {
        const result = await postImport({ data: { site_id: siteId, rows } });
        toast.info(`${result.imported} new · ${result.skipped} already imported`);
      }, "SumUp expense report imported");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not read the CSV");
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function exportManagement() {
    if (!data) return;
    download(`cafe1-management-${fromDate}-${toDate}.csv`, [
      ["Cafe1 management P&L", data.site?.legal_name ?? "", `${fromDate} to ${toDate}`],
      ["Metric", "GBP / value"],
      ["Sales income", (data.sales_income_cents / 100).toFixed(2)],
      ["Cost of goods sold", (data.cogs_cents / 100).toFixed(2)],
      ["Gross profit", (data.gross_profit_cents / 100).toFixed(2)],
      ["Operating expenses", (data.operating_expenses_cents / 100).toFixed(2)],
      ["Operating profit", (data.operating_profit_cents / 100).toFixed(2)],
      ["Orders", data.order_count],
      ["Average order", (data.average_order_cents / 100).toFixed(2)],
      ["Gross margin", data.gross_margin_percent],
      ["Food cost", data.food_cost_percent],
      [],
      ["Date", "Sales income", "Orders", "Operating expenses"],
      ...data.daily.map((row) => [
        row.date,
        (row.income_cents / 100).toFixed(2),
        row.orders,
        (row.expenses_cents / 100).toFixed(2),
      ]),
    ]);
  }
  function exportExpenses() {
    if (!data) return;
    download(`cafe1-expenses-${isoDate()}.csv`, [
      [
        "Date",
        "Category",
        "Supplier",
        "Description",
        "Gross amount",
        "Tax included (not reclaimed)",
        "Payment method",
        "Source",
        "Invoice",
        "Receipt",
      ],
      ...data.recent_expenses.map((row) => [
        row.expense_date,
        CATEGORY_LABELS[row.category] ?? row.category,
        row.supplier_name ?? "",
        row.description,
        (row.amount_cents / 100).toFixed(2),
        (row.tax_included_cents / 100).toFixed(2),
        PAYMENT_LABELS[row.payment_method] ?? row.payment_method,
        row.source,
        row.invoice_reference ?? "",
        row.receipt_reference ?? "",
      ]),
    ]);
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-5 sm:py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-brand">
              <BadgePoundSterling className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Financials & KPIs</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Management P&amp;L, stock purchasing, expenses and SumUp reconciliation. Gross
                amounts are used because Café 1 is not VAT registered.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SiteSwitcher
              sites={sites}
              siteId={siteId}
              onChange={setSiteId}
              compact
              loading={sitesLoading}
              error={sitesError}
            />
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>




        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["overview", "Overview", BarChart3],
              ["expenses", "Expenses", ReceiptText],
              ["purchases", "Purchases", Boxes],
              ["sumup", "SumUp", WalletCards],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold ${section === id ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-semibold">Financial dashboard is not ready</p>
            <p className="mt-1">{error}</p>
            <p className="mt-2">
              Apply the Phase 33 migration and sign in with manager authenticator MFA (AAL2).
            </p>
          </div>
        )}
        {loading && !data ? (
          <div className="grid min-h-72 place-items-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : null}
        {data && section === "overview" && (
          <Overview data={data} days={days} setDays={setDays} exportCsv={exportManagement} />
        )}
        {data && section === "expenses" && (
          <Expenses
            data={data}
            siteId={siteId}
            busy={busy}
            run={run}
            postExpense={postExpense}
            postVoid={postVoid}
            exportCsv={exportExpenses}
          />
        )}
        {data && section === "purchases" && (
          <Purchases
            data={data}
            inventory={inventory}
            siteId={siteId}
            busy={busy}
            run={run}
            postSupplier={postSupplier}
            postPurchase={postPurchase}
          />
        )}
        {data && section === "sumup" && (
          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            <Panel
              title="Automatic settlement reconciliation"
              subtitle="Pulls official SumUp payouts, deductions and processing fees. Repeating a sync updates existing references; it never duplicates fees."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Paid out" value={money(data.sumup.paid_out_cents)} />
                <Metric label="Deductions" value={money(data.sumup.deductions_cents)} />
                <Metric label="Fees" value={money(data.sumup.fees_cents)} />
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      postSync({ data: { site_id: siteId, from_date: fromDate, to_date: toDate } }),
                    "SumUp settlements and fees reconciled",
                  )
                }
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
                Sync {days} days
              </button>
              <p className="mt-3 text-xs text-muted-foreground">
                The SumUp API key needs <code>payouts.read</code>. Refund and chargeback deductions
                are stored for settlement reconciliation, not double-posted as ordinary expenses.
              </p>
            </Panel>
            <Panel
              title="Import SumUp expense history"
              subtitle="SumUp exposes POS Expenses in Back Office as a CSV export, not through its documented public API. Export it, then import it here."
            >
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>1. SumUp Back Office → Transactions → Expenses.</li>
                <li>2. Choose the period and select Export → CSV.</li>
                <li>3. Import below. Identical rows are skipped automatically.</li>
              </ol>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleExpenseCsv(file);
                }}
              />
              <button
                disabled={busy}
                onClick={() => fileInput.current?.click()}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl border border-primary bg-primary-soft px-5 text-sm font-bold text-primary disabled:opacity-50"
              >
                <FileUp className="h-4 w-4" />
                Choose SumUp expense CSV
              </button>
              <p className="mt-3 text-xs text-muted-foreground">
                The CSV parser supports quoted descriptions, UK/ISO dates, VAT shown by SumUp,
                payment method, operator and bill number. VAT is retained only as invoice
                information and is not reclaimed.
              </p>
            </Panel>
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  positive,
}: {
  label: string;
  value: string;
  note?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-2xl font-bold ${positive === false ? "text-destructive" : ""}`}
      >
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Overview({
  data,
  days,
  setDays,
  exportCsv,
}: {
  data: FinanceDashboard;
  days: number;
  setDays: (n: number) => void;
  exportCsv: () => void;
}) {
  const max = Math.max(1, ...data.daily.map((row) => row.income_cents));
  const costCoverage = data.sold_lines
    ? Math.round(((data.sold_lines - data.zero_cost_lines) * 100) / data.sold_lines)
    : 100;
  return (
    <>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {[1, 7, 30, 90].map((value) => (
            <button
              key={value}
              onClick={() => setDays(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${days === value ? "bg-foreground text-background" : "border border-border bg-card"}`}
            >
              {value === 1 ? "Today" : `${value} days`}
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold"
        >
          <Download className="h-3.5 w-3.5" />
          Management CSV
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Sales income"
          value={money(data.sales_income_cents)}
          note={`${money(data.voucher_income_cents)} HMCTS voucher income`}
        />
        <Metric
          label="Gross profit"
          value={money(data.gross_profit_cents)}
          note={`${percent(data.gross_margin_percent)} margin`}
        />
        <Metric
          label="Operating expenses"
          value={money(data.operating_expenses_cents)}
          note={`${money(data.payment_fees_cents)} payment fees`}
        />
        <Metric
          label="Operating result"
          value={money(data.operating_profit_cents)}
          note={`${percent(data.operating_margin_percent)} margin`}
          positive={data.operating_profit_cents >= 0}
        />
        <Metric
          label="Orders"
          value={String(data.order_count)}
          note={`${money(data.average_order_cents)} average`}
        />
        <Metric
          label="Food cost"
          value={money(data.cogs_cents)}
          note={`${percent(data.food_cost_percent)} of income`}
        />
        <Metric
          label="Stock value"
          value={money(data.stock_value_cents)}
          note={`${data.low_stock_count} low-stock lines`}
        />
        <Metric
          label="Purchases received"
          value={money(data.purchase_outflow_cents)}
          note="Cash/credit outflow, not double-counted as overhead"
        />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Daily sales and expenses"
          subtitle="Bars show earned customer and HMCTS voucher income; the line below each day shows posted operating expenses."
        >
          <div className="flex h-52 items-end gap-1 overflow-hidden">
            {data.daily.map((row) => (
              <div
                key={row.date}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                title={`${row.date}: ${money(row.income_cents)}; expenses ${money(row.expenses_cents)}`}
              >
                <span className="hidden text-[9px] text-muted-foreground sm:block">
                  {row.income_cents ? money(row.income_cents) : ""}
                </span>
                <div
                  className="w-full rounded-t-md bg-primary"
                  style={{ height: `${Math.max(2, (row.income_cents / max) * 145)}px` }}
                />
                <span className="max-w-full truncate text-[9px] text-muted-foreground">
                  {new Date(`${row.date}T12:00:00`).toLocaleDateString("en-GB", {
                    weekday: "narrow",
                    day: days > 7 ? undefined : "numeric",
                  })}
                </span>
                <span className="text-[9px] font-semibold text-destructive">
                  {row.expenses_cents ? `-${money(row.expenses_cents)}` : ""}
                </span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Control KPIs">
          <dl className="space-y-3 text-sm">
            {[
              ["Gross margin", percent(data.gross_margin_percent)],
              ["Food-cost ratio", percent(data.food_cost_percent)],
              ["Refund rate", percent(data.refund_rate_percent)],
              ["Costed sale-line coverage", `${costCoverage}%`],
              ["Waste", money(data.waste_cents)],
              ["Staff meals", money(data.staff_meal_cents)],
              ["Stock variance", money(data.stock_variance_cents)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {data.zero_cost_lines > 0 && (
            <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800">
              {data.zero_cost_lines} sold line(s) have no cost. Complete recipes or item costs
              before relying on gross margin.
            </p>
          )}
        </Panel>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Income bridge">
          <dl className="space-y-2 text-sm">
            <MoneyRow label="Customer income kept" value={data.customer_income_cents} />
            <MoneyRow label="HMCTS voucher claims" value={data.voucher_income_cents} />
            <MoneyRow label="Total sales income" value={data.sales_income_cents} strong />
            <MoneyRow label="Refunds" value={-data.refunds_cents} />
            <MoneyRow label="Discounts given" value={-data.discounts_cents} />
          </dl>
        </Panel>
        <Panel title="Operating expense mix">
          {data.expense_categories.length ? (
            <div className="space-y-2">
              {data.expense_categories.map((row) => (
                <div key={row.category} className="flex items-center justify-between text-sm">
                  <span>
                    {CATEGORY_LABELS[row.category] ?? row.category}{" "}
                    <span className="text-xs text-muted-foreground">×{row.count}</span>
                  </span>
                  <span className="font-semibold">{money(row.amount_cents)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No posted expenses in this period.</p>
          )}
        </Panel>
      </div>
      <p className="mt-4 rounded-2xl border border-border bg-secondary/50 p-4 text-xs text-muted-foreground">
        <strong>Accounting scope:</strong> this is an operational management P&amp;L, not statutory
        accounts or a tax return. Income includes customer consideration plus valid HMCTS voucher
        claims. Stock receipts increase inventory and flow into cost of goods when items sell; they
        are not also posted as operating expenses. Payroll, depreciation, accruals and corporation
        tax are included only when entered or handled by your accountant.
      </p>
    </>
  );
}
function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${strong ? "border-t border-border pt-2 font-bold" : ""}`}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={value < 0 ? "text-destructive" : ""}>
        {value < 0 ? "−" : ""}
        {money(Math.abs(value))}
      </dd>
    </div>
  );
}

function Expenses({
  data,
  siteId,
  busy,
  run,
  postExpense,
  postVoid,
  exportCsv,
}: {
  data: FinanceDashboard;
  siteId: string;
  busy: boolean;
  run: (task: () => Promise<unknown>, success: string) => Promise<void>;
  postExpense: ReturnType<typeof useServerFn<typeof saveExpense>>;
  postVoid: ReturnType<typeof useServerFn<typeof voidExpense>>;
  exportCsv: () => void;
}) {
  const [form, setForm] = useState({
    expense_date: isoDate(),
    category: "supplies",
    supplier_id: "",
    description: "",
    amount: "",
    tax: "",
    payment_method: "card",
    invoice_reference: "",
    receipt_reference: "",
    notes: "",
  });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await run(
      () =>
        postExpense({
          data: {
            site_id: siteId,
            expense_date: form.expense_date,
            category: form.category as (typeof EXPENSE_CATEGORIES)[number],
            supplier_id: form.supplier_id || undefined,
            description: form.description,
            amount_cents: poundsToPence(form.amount),
            tax_included_cents: poundsToPence(form.tax),
            payment_method: form.payment_method as (typeof PAYMENT_METHODS)[number],
            invoice_reference: form.invoice_reference,
            receipt_reference: form.receipt_reference,
            notes: form.notes,
          },
        }),
      "Expense posted",
    );
    setForm((v) => ({
      ...v,
      description: "",
      amount: "",
      tax: "",
      invoice_reference: "",
      receipt_reference: "",
      notes: "",
    }));
  }
  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-[390px_1fr]">
      <Panel
        title="Post operating expense"
        subtitle="Enter the gross amount paid. VAT shown on an invoice remains part of the cost and is not reclaimed."
      >
        <form onSubmit={(e) => void submit(e)} className="grid gap-3">
          <Field label="Date">
            <input
              required
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {EXPENSE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supplier (optional)">
            <select
              value={form.supplier_id}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            >
              <option value="">No supplier</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <input
              required
              minLength={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What was purchased?"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Gross amount £">
              <input
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Field label="VAT included £">
              <input
                inputMode="decimal"
                value={form.tax}
                onChange={(e) => setForm({ ...form, tax: e.target.value })}
                placeholder="Information only"
              />
            </Field>
          </div>
          <Field label="Payment method">
            <select
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
            >
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Invoice">
              <input
                value={form.invoice_reference}
                onChange={(e) => setForm({ ...form, invoice_reference: e.target.value })}
              />
            </Field>
            <Field label="Receipt reference">
              <input
                value={form.receipt_reference}
                onChange={(e) => setForm({ ...form, receipt_reference: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <button
            disabled={busy}
            className="h-11 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50"
          >
            Post expense
          </button>
        </form>
      </Panel>
      <Panel
        title="Expense ledger"
        subtitle={`${data.recent_expenses.length} most recent posted expenses`}
      >
        <div className="mb-3 flex justify-end">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            Expense CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Method</th>
                <th className="text-right">Gross</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.recent_expenses.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-3">
                    {new Date(`${row.expense_date}T12:00:00`).toLocaleDateString("en-GB")}
                  </td>
                  <td>
                    <p className="font-semibold">{row.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.supplier_name || row.source}
                      {row.invoice_reference ? ` · ${row.invoice_reference}` : ""}
                    </p>
                  </td>
                  <td>{CATEGORY_LABELS[row.category] ?? row.category}</td>
                  <td>{PAYMENT_LABELS[row.payment_method] ?? row.payment_method}</td>
                  <td className="text-right font-semibold">{money(row.amount_cents)}</td>
                  <td className="text-right">
                    <button
                      aria-label="Void expense"
                      disabled={busy}
                      onClick={() =>
                        void (async () => {
                          const reason = await askPrompt({
                            title: "Void expense",
                            description: `This preserves the audit trail for ${money(row.amount_cents)}. Give the correction reason.`,
                            label: "Reason",
                            confirmLabel: "Void expense",
                          });
                          if (reason)
                            await run(
                              () => postVoid({ data: { expense_id: row.id, reason } }),
                              "Expense voided",
                            );
                        })()
                      }
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.recent_expenses.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No expenses posted yet.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Purchases({
  data,
  inventory,
  siteId,
  busy,
  run,
  postSupplier,
  postPurchase,
}: {
  data: FinanceDashboard;
  inventory: InventoryItem[];
  siteId: string;
  busy: boolean;
  run: (task: () => Promise<unknown>, success: string) => Promise<void>;
  postSupplier: ReturnType<typeof useServerFn<typeof saveSupplier>>;
  postPurchase: ReturnType<typeof useServerFn<typeof receivePurchase>>;
}) {
  const [showSupplier, setShowSupplier] = useState(false);
  const [supplier, setSupplier] = useState({
    name: "",
    contact_name: "",
    email: "",
    phone: "",
    account_reference: "",
    lead_days: 0,
  });
  const [form, setForm] = useState({
    supplier_id: "",
    invoice_number: "",
    supplier_reference: "",
    invoice_date: isoDate(),
    delivery_cost: "",
    discount: "",
    payment_method: "bank_transfer",
    payment_status: "unpaid",
    note: "",
  });
  const [lines, setLines] = useState<PurchaseLine[]>([
    { inventory_item_id: "", quantity: "", unit_cost: "" },
  ]);
  const estimated =
    lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_cost || 0), 0) +
    Number(form.delivery_cost || 0) -
    Number(form.discount || 0);
  async function addSupplier(event: React.FormEvent) {
    event.preventDefault();
    await run(() => postSupplier({ data: { site_id: siteId, ...supplier } }), "Supplier saved");
    setSupplier({
      name: "",
      contact_name: "",
      email: "",
      phone: "",
      account_reference: "",
      lead_days: 0,
    });
    setShowSupplier(false);
  }
  async function receive(event: React.FormEvent) {
    event.preventDefault();
    await run(
      () =>
        postPurchase({
          data: {
            site_id: siteId,
            supplier_id: form.supplier_id,
            invoice_number: form.invoice_number,
            supplier_reference: form.supplier_reference,
            invoice_date: form.invoice_date,
            delivery_cost_cents: poundsToPence(form.delivery_cost),
            discount_cents: poundsToPence(form.discount),
            payment_method: form.payment_method as (typeof PAYMENT_METHODS)[number],
            payment_status: form.payment_status as "paid" | "unpaid",
            note: form.note,
            lines: lines.map((line) => ({
              inventory_item_id: line.inventory_item_id,
              quantity: Number(line.quantity),
              unit_cost_cents: poundsToPence(line.unit_cost),
            })),
          },
        }),
      "Purchase received and stock updated",
    );
    setForm((v) => ({
      ...v,
      invoice_number: "",
      supplier_reference: "",
      delivery_cost: "",
      discount: "",
      note: "",
    }));
    setLines([{ inventory_item_id: "", quantity: "", unit_cost: "" }]);
  }
  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
      <Panel
        title="Receive supplier stock"
        subtitle="Receiving creates one purchase, updates quantities and weighted costs, and writes stock-ledger entries atomically."
      >
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setShowSupplier(!showSupplier)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
          >
            <Store className="h-3.5 w-3.5" />
            {showSupplier ? "Close" : "New supplier"}
          </button>
        </div>
        {showSupplier && (
          <form
            onSubmit={(e) => void addSupplier(e)}
            className="mb-5 grid gap-2 rounded-xl bg-secondary p-3"
          >
            <Field label="Supplier name">
              <input
                required
                value={supplier.name}
                onChange={(e) => setSupplier({ ...supplier, name: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Contact">
                <input
                  value={supplier.contact_name}
                  onChange={(e) => setSupplier({ ...supplier, contact_name: e.target.value })}
                />
              </Field>
              <Field label="Account ref">
                <input
                  value={supplier.account_reference}
                  onChange={(e) => setSupplier({ ...supplier, account_reference: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Email">
                <input
                  type="email"
                  value={supplier.email}
                  onChange={(e) => setSupplier({ ...supplier, email: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <input
                  value={supplier.phone}
                  onChange={(e) => setSupplier({ ...supplier, phone: e.target.value })}
                />
              </Field>
            </div>
            <button
              disabled={busy}
              className="h-10 rounded-xl bg-foreground text-sm font-bold text-background"
            >
              Save supplier
            </button>
          </form>
        )}
        <form onSubmit={(e) => void receive(e)} className="grid gap-3">
          <Field label="Supplier">
            <select
              required
              value={form.supplier_id}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            >
              <option value="">Choose supplier</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Invoice number">
              <input
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
              />
            </Field>
            <Field label="Invoice date">
              <input
                required
                type="date"
                value={form.invoice_date}
                onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
              />
            </Field>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Stock lines
            </p>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_72px_90px_36px] gap-1.5">
                <select
                  required
                  aria-label={`Stock item ${index + 1}`}
                  value={line.inventory_item_id}
                  onChange={(e) =>
                    setLines(
                      lines.map((v, i) =>
                        i === index ? { ...v, inventory_item_id: e.target.value } : v,
                      ),
                    )
                  }
                >
                  <option value="">Item</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.unit})
                    </option>
                  ))}
                </select>
                <input
                  required
                  aria-label={`Quantity ${index + 1}`}
                  inputMode="decimal"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) =>
                    setLines(
                      lines.map((v, i) => (i === index ? { ...v, quantity: e.target.value } : v)),
                    )
                  }
                />
                <input
                  required
                  aria-label={`Unit cost ${index + 1}`}
                  inputMode="decimal"
                  placeholder="£ each"
                  value={line.unit_cost}
                  onChange={(e) =>
                    setLines(
                      lines.map((v, i) => (i === index ? { ...v, unit_cost: e.target.value } : v)),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label="Remove line"
                  disabled={lines.length === 1}
                  onClick={() => setLines(lines.filter((_, i) => i !== index))}
                  className="grid place-items-center rounded-lg border border-border disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setLines([...lines, { inventory_item_id: "", quantity: "", unit_cost: "" }])
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Add stock line
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Delivery £">
              <input
                inputMode="decimal"
                value={form.delivery_cost}
                onChange={(e) => setForm({ ...form, delivery_cost: e.target.value })}
              />
            </Field>
            <Field label="Discount £">
              <input
                inputMode="decimal"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Payment method">
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              >
                {PAYMENT_METHODS.map((v) => (
                  <option key={v} value={v}>
                    {PAYMENT_LABELS[v]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Payment status">
              <select
                value={form.payment_status}
                onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
              >
                <option value="unpaid">Unpaid / credit</option>
                <option value="paid">Paid</option>
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <div className="flex items-center justify-between rounded-xl bg-secondary p-3">
            <span className="text-sm text-muted-foreground">Calculated invoice total</span>
            <strong>{money(Math.max(0, Math.round(estimated * 100)))}</strong>
          </div>
          <button
            disabled={busy}
            className="h-11 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50"
          >
            Receive purchase & update stock
          </button>
        </form>
      </Panel>
      <Panel
        title="Purchase register"
        subtitle="Stock purchases are balance-sheet/cash-flow activity until stock is sold; COGS is recognised from sale-line cost snapshots."
      >
        <div className="space-y-2">
          {data.recent_purchases.map((row) => (
            <article
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <div>
                <p className="font-semibold">{row.supplier_name || "Supplier"}</p>
                <p className="text-xs text-muted-foreground">
                  {row.invoice_date
                    ? new Date(`${row.invoice_date}T12:00:00`).toLocaleDateString("en-GB")
                    : "No invoice date"}
                  {row.invoice_number ? ` · ${row.invoice_number}` : ""} · {row.line_count} line(s)
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold">{money(row.total_cost_cents)}</p>
                <p
                  className={`text-xs ${row.payment_status === "paid" ? "text-emerald-700" : "text-amber-700"}`}
                >
                  {row.payment_status}
                </p>
              </div>
            </article>
          ))}
          {!data.recent_purchases.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No supplier purchases received yet.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
      <span>{label}</span>
      <span className="[&>input]:h-10 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-border [&>input]:bg-background [&>input]:px-3 [&>select]:h-10 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-border [&>select]:bg-background [&>select]:px-2 [&>textarea]:w-full [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:border-border [&>textarea]:bg-background [&>textarea]:p-3">
        {children}
      </span>
    </label>
  );
}
