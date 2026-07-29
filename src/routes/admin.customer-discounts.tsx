import { createFileRoute } from "@tanstack/react-router";
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
      { name: "description", content: "Approve individual customers for an automatic member discount at Cafe1." },
      { property: "og:title", content: "Approved members — Cafe1 Admin" },
      { property: "og:description", content: "Approve individual customers for an automatic member discount at Cafe1." },
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

type Row = {
  id: string;
  email: string;
  percent: number;
  label: string | null;
  active: boolean;
  created_at: string;
};

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

  const [form, setForm] = useState({ email: "", percent: 10, label: "" });
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("customer_discounts").insert({
      email: form.email.trim().toLowerCase(),
      percent: form.percent,
      label: form.label.trim() || null,
      active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message.includes("duplicate") ? "That email already has a discount." : error.message);
    toast.success("Discount saved");
    setForm({ email: "", percent: 10, label: "" });
    qc.invalidateQueries({ queryKey: ["admin-customer-discounts"] });
  }

  async function update(id: string, patch: Partial<Row>) {
    const { error } = await supabase.from("customer_discounts").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-customer-discounts"] });
  }

  async function remove(id: string) {
    if (!confirm("Remove this member's approval?")) return;
    const { error } = await supabase.from("customer_discounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-customer-discounts"] });
  }

  async function addBulk() {
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
    const { error } = await supabase
      .from("customer_discounts")
      .upsert(
        emails.map((email) => ({ email, percent: form.percent, label: form.label.trim() || null, active: true })),
        { onConflict: "email" },
      );
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${emails.length} member${emails.length === 1 ? "" : "s"} approved at ${form.percent}%`);
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
            <h1 className="font-display text-3xl font-bold">Customer discounts</h1>
            <p className="text-sm text-muted-foreground">
              Automatic % off for specific email addresses — applied at checkout with no code needed.
            </p>
          </div>
        </div>

        <form onSubmit={create} className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold">Add a customer</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              required
              type="email"
              placeholder="customer@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-11 rounded-xl border border-border bg-background px-4 sm:col-span-2"
            />
            <input
              required
              type="number"
              min={1}
              max={100}
              placeholder="% off"
              value={form.percent}
              onChange={(e) => setForm({ ...form, percent: parseInt(e.target.value || "0", 10) })}
              className="h-11 rounded-xl border border-border bg-background px-4"
            />
          </div>
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
            {busy ? "Saving…" : "Add discount"}
          </button>
        </form>

        <h2 className="mt-10 font-display text-xl font-bold">Discounted customers</h2>
        <ul className="mt-3 space-y-2">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <span className="rounded-lg border border-dashed border-primary bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
                {r.percent}%
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.email}</p>
                {r.label && <p className="text-xs text-muted-foreground">{r.label}</p>}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={r.active} onChange={(e) => update(r.id, { active: e.target.checked })} />
                Active
              </label>
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
              No customer discounts yet.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
