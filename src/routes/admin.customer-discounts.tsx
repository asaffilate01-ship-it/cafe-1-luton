import { createFileRoute } from "@tanstack/react-router";
import { askConfirm } from "@/lib/confirm";
import { AdminNav } from "@/components/admin-nav";
import { useState } from "react";
import { RequireRole } from "@/components/require-role";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgePercent, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/customer-discounts")({
  head: () => ({
    meta: [
      { title: "Approved members — Cafe1 Admin" },
      {
        name: "description",
        content: "Approve individual customers for an automatic member discount at Cafe1.",
      },
      { property: "og:title", content: "Approved members — Cafe1 Admin" },
      {
        property: "og:description",
        content: "Approve individual customers for an automatic member discount at Cafe1.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireRole roles={["admin", "staff"]} next="/admin/customer-discounts">
      <AdminCustomerDiscounts />
    </RequireRole>
  ),
});

type DiscountType = "percent" | "fixed_amount" | "free_delivery";

type Row = {
  id: string;
  email: string;
  percent: number;
  amount_cents: number;
  discount_type: DiscountType;
  label: string | null;
  active: boolean;
  created_at: string;
};

const TYPE_LABELS: Record<DiscountType, string> = {
  percent: "% off",
  fixed_amount: "£ off",
  free_delivery: "Free delivery",
};

function money(cents: number) {
  return `£${(cents / 100).toFixed(2)}`;
}

/** Short pill text summarising what a member actually gets. */
function summarise(row: Pick<Row, "discount_type" | "percent" | "amount_cents">) {
  if (row.discount_type === "fixed_amount") return `${money(row.amount_cents)} off`;
  if (row.discount_type === "free_delivery") return "Free delivery";
  return `${row.percent}%`;
}

function AdminCustomerDiscounts() {
  const qc = useQueryClient();

  const { data: rows } = useQuery({
    queryKey: ["admin-customer-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_discounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [form, setForm] = useState({
    email: "",
    discount_type: "percent" as DiscountType,
    percent: 10,
    amount_pounds: "5.00",
    label: "",
  });
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  /** Builds the discount columns from the form, validating the chosen type. */
  function discountPayload() {
    if (form.discount_type === "fixed_amount") {
      const cents = Math.round(parseFloat(form.amount_pounds || "0") * 100);
      if (!Number.isFinite(cents) || cents <= 0) {
        toast.error("Enter an amount off, e.g. 5.00");
        return null;
      }
      return { discount_type: "fixed_amount", percent: 0, amount_cents: cents };
    }
    if (form.discount_type === "free_delivery") {
      return { discount_type: "free_delivery", percent: 0, amount_cents: 0 };
    }
    if (!(form.percent > 0 && form.percent <= 100)) {
      toast.error("Enter a percentage between 1 and 100");
      return null;
    }
    return { discount_type: "percent", percent: form.percent, amount_cents: 0 };
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const payload = discountPayload();
    if (!payload) return;
    setBusy(true);
    const { error } = await supabase.from("customer_discounts").insert({
      email: form.email.trim().toLowerCase(),
      label: form.label.trim() || null,
      active: true,
      ...payload,
    });
    setBusy(false);
    if (error)
      return toast.error(
        error.message.includes("duplicate") ? "That email already has a discount." : error.message,
      );
    toast.success("Discount saved");
    setForm({ ...form, email: "", label: "" });
    qc.invalidateQueries({ queryKey: ["admin-customer-discounts"] });
  }

  async function update(id: string, patch: Partial<Row>) {
    const { error } = await supabase.from("customer_discounts").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-customer-discounts"] });
  }

  async function remove(id: string) {
    if (!(await askConfirm("Remove this member's approval?"))) return;
    const { error } = await supabase.from("customer_discounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-customer-discounts"] });
  }

  async function addBulk() {
    const payload = discountPayload();
    if (!payload) return;
    const emails = Array.from(
      new Set(
        bulk
          .split(/[\s,;]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)),
      ),
    );
    if (!emails.length) return toast.error("No valid email addresses found");
    setBulkBusy(true);
    const { error } = await supabase.from("customer_discounts").upsert(
      emails.map((email) => ({
        email,
        label: form.label.trim() || null,
        active: true,
        ...payload,
      })),
      { onConflict: "email" },
    );
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    toast.success(
      `${emails.length} member${emails.length === 1 ? "" : "s"} approved — ${summarise({
        discount_type: payload.discount_type as DiscountType,
        percent: payload.percent,
        amount_cents: payload.amount_cents,
      })}`,
    );
    setBulk("");
    qc.invalidateQueries({ queryKey: ["admin-customer-discounts"] });
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
            <BadgePercent className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">Approved members</h1>
            <p className="text-sm text-muted-foreground">
              Only people on this list get a member discount. It applies automatically at checkout
              when they use their approved email address — no code needed. Each person can have a
              percentage, a fixed amount off, or free delivery.
            </p>
          </div>
        </div>

        <form
          onSubmit={create}
          className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-5"
        >
          <p className="font-semibold">Approve a member</p>
          <input
            required
            type="email"
            placeholder="customer@company.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-background px-4"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(TYPE_LABELS) as DiscountType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, discount_type: t })}
                className={`h-11 rounded-xl border text-sm font-semibold ${
                  form.discount_type === t
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          {form.discount_type === "percent" && (
            <input
              required
              type="number"
              min={1}
              max={100}
              placeholder="% off"
              value={form.percent}
              onChange={(e) => setForm({ ...form, percent: parseInt(e.target.value || "0", 10) })}
              className="h-11 w-full rounded-xl border border-border bg-background px-4"
              aria-label="Percentage off"
            />
          )}
          {form.discount_type === "fixed_amount" && (
            <input
              required
              type="number"
              min={0.01}
              step={0.01}
              placeholder="Amount off in pounds, e.g. 5.00"
              value={form.amount_pounds}
              onChange={(e) => setForm({ ...form, amount_pounds: e.target.value })}
              className="h-11 w-full rounded-xl border border-border bg-background px-4"
              aria-label="Amount off in pounds"
            />
          )}
          <input
            placeholder="Label shown at checkout (e.g. Crown Court staff discount)"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-background px-4"
          />
          <button
            disabled={busy}
            className="h-11 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-brand hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? "Saving…" : "Approve member"}
          </button>

          <div className="rounded-xl border border-dashed border-border p-4">
            <p className="text-sm font-semibold">Approve several at once</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Paste emails separated by commas, spaces or new lines. They'll all get the discount and
              label above.
            </p>
            <textarea
              rows={3}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder="one@court.gov.uk, two@court.gov.uk"
              className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm"
            />
            <button
              type="button"
              onClick={addBulk}
              disabled={bulkBusy}
              className="mt-2 h-10 rounded-full border border-primary px-5 text-sm font-semibold text-primary hover:bg-primary-soft disabled:opacity-60"
            >
              {bulkBusy ? "Approving…" : "Approve list"}
            </button>
          </div>
        </form>

        <h2 className="mt-10 font-display text-xl font-bold">Approved members</h2>
        <ul className="mt-3 space-y-2">
          {(rows ?? []).map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <span className="rounded-lg border border-dashed border-primary bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
                {summarise(r)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.email}</p>
                {r.label && <p className="text-xs text-muted-foreground">{r.label}</p>}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={r.active}
                  onChange={(e) => update(r.id, { active: e.target.checked })}
                />
                Active
              </label>
              <select
                value={r.discount_type}
                onChange={(e) => {
                  const t = e.target.value as DiscountType;
                  update(r.id, {
                    discount_type: t,
                    percent: t === "percent" ? r.percent || 10 : 0,
                    amount_cents: t === "fixed_amount" ? r.amount_cents || 500 : 0,
                  });
                }}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                aria-label={`Discount type for ${r.email}`}
              >
                {(Object.keys(TYPE_LABELS) as DiscountType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              {r.discount_type === "percent" && (
                <input
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={r.percent}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value || "0", 10);
                    if (v > 0 && v <= 100 && v !== r.percent) update(r.id, { percent: v });
                  }}
                  className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-sm"
                  aria-label={`Discount percent for ${r.email}`}
                />
              )}
              {r.discount_type === "fixed_amount" && (
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  defaultValue={(r.amount_cents / 100).toFixed(2)}
                  onBlur={(e) => {
                    const v = Math.round(parseFloat(e.target.value || "0") * 100);
                    if (v > 0 && v !== r.amount_cents) update(r.id, { amount_cents: v });
                  }}
                  className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-sm"
                  aria-label={`Amount off in pounds for ${r.email}`}
                />
              )}
              <button
                onClick={() => remove(r.id)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                aria-label={`Remove discount for ${r.email}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {rows && rows.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No approved members yet — nobody is receiving a discount.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
