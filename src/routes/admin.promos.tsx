import { createFileRoute } from "@tanstack/react-router";
import { askConfirm } from "@/components/confirm-dialog";
import { AdminNav } from "@/components/admin-nav";
import { useState } from "react";
import { RequireRole } from "@/components/require-role";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ticket, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/promos")({
  head: () => ({ meta: [{ title: "Promo codes — Cafe1 Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RequireRole roles={["admin", "staff"]} next="/admin/promos">
      <AdminPromos />
    </RequireRole>
  ),
});

type Row = {
  id: string; code: string; description: string | null;
  discount_type: "percent" | "fixed_amount" | "free_delivery";
  discount_value: number; min_subtotal_cents: number;
  max_uses: number | null; uses: number; active: boolean;
  applies_to: "all" | "delivery" | "collection" | "dine_in";
  expires_at: string | null; starts_at: string | null; first_order_only: boolean;
};

function AdminPromos() {
  const qc = useQueryClient();

  const { data: rows } = useQuery({
    queryKey: ["admin-promos"],
    queryFn: async () => {
      const { data } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Row[];
    },
  });

  const [form, setForm] = useState({
    code: "", description: "",
    discount_type: "percent" as Row["discount_type"], discount_value: "10",
    min_subtotal: "", max_uses: "", applies_to: "all" as Row["applies_to"],
    starts_at: "", expires_at: "", first_order_only: false,
  });
  const [busy, setBusy] = useState(false);

  const poundsToPence = (v: string) => Math.round(parseFloat(v || "0") * 100) || 0;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    if (code.length < 3) return toast.error("Code must be at least 3 characters");
    const value =
      form.discount_type === "free_delivery" ? 0
      : form.discount_type === "percent" ? Math.round(parseFloat(form.discount_value || "0"))
      : poundsToPence(form.discount_value);
    if (form.discount_type === "percent" && (value < 1 || value > 100)) return toast.error("Percentage must be between 1 and 100");
    if (form.discount_type !== "free_delivery" && value <= 0) return toast.error("Enter a discount amount");
    setBusy(true);
    const { error } = await supabase.from("promo_codes").insert({
      code,
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: value,
      min_subtotal_cents: poundsToPence(form.min_subtotal),
      max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
      applies_to: form.applies_to,
      first_order_only: form.first_order_only,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message.includes("duplicate") ? "That code already exists" : error.message);
    toast.success("Promo code created");
    setForm({ ...form, code: "", description: "" });
    qc.invalidateQueries({ queryKey: ["admin-promos"] });
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("promo_codes").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-promos"] });
  }
  async function remove(id: string) {
    if (!(await askConfirm("Delete this code?"))) return;
    await supabase.from("promo_codes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-promos"] });
  }

  function fmtDiscount(r: Row) {
    if (r.discount_type === "percent") return `${r.discount_value}% off`;
    if (r.discount_type === "fixed_amount") return `£${(r.discount_value/100).toFixed(2)} off`;
    return "Free delivery";
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary"><Ticket className="h-5 w-5" /></span>
          <div>
            <h1 className="font-display text-3xl font-bold">Promo codes</h1>
            <p className="text-sm text-muted-foreground">Discount codes customers enter at checkout.</p>
          </div>
        </div>

        <form onSubmit={create} className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold">New code</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input required maxLength={30} placeholder="Code (e.g. WELCOME10)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="h-11 rounded-xl border border-border bg-background px-4 font-mono uppercase" />
            <input placeholder="Description (internal)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as Row["discount_type"] })} className="h-11 rounded-xl border border-border bg-background px-3">
              <option value="percent">% off subtotal</option>
              <option value="fixed_amount">Fixed amount off</option>
              <option value="free_delivery">Free delivery</option>
            </select>
            <input type="number" step="0.01" min="0" placeholder={form.discount_type === "percent" ? "Discount %" : "Discount £"} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" disabled={form.discount_type === "free_delivery"} />
            <input type="number" step="0.01" min="0" placeholder="Min spend £ (optional)" value={form.min_subtotal} onChange={(e) => setForm({ ...form, min_subtotal: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value as Row["applies_to"] })} className="h-11 rounded-xl border border-border bg-background px-3">
              <option value="all">All order types</option>
              <option value="delivery">Delivery only</option>
              <option value="collection">Pickup only</option>
              <option value="dine_in">Dine-in only</option>
            </select>
            <input type="number" placeholder="Max uses (blank = ∞)" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
            <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm">
              <input type="checkbox" checked={form.first_order_only} onChange={(e) => setForm({ ...form, first_order_only: e.target.checked })} />
              First order only
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              Starts (optional)
              <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
            </label>
            <label className="text-xs text-muted-foreground">
              Expires (optional)
              <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
            </label>
          </div>
          <button disabled={busy} className="h-11 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-brand hover:bg-primary-hover disabled:opacity-60">
            {busy ? "Saving…" : "Create code"}
          </button>
        </form>

        <h2 className="mt-10 font-display text-xl font-bold">All codes</h2>
        <ul className="mt-3 space-y-2">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <span className="rounded-lg border border-dashed border-primary bg-primary-soft px-3 py-1 font-mono text-sm font-bold text-primary">{r.code}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{fmtDiscount(r)} · {r.applies_to.replace("_"," ")}</p>
                {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                <p className="text-xs text-muted-foreground">
                  Used {r.uses}{r.max_uses ? `/${r.max_uses}` : ""}
                  {r.min_subtotal_cents > 0 && ` · min £${(r.min_subtotal_cents/100).toFixed(2)}`}
                  {r.first_order_only && " · first order only"}
                  {r.starts_at && ` · from ${new Date(r.starts_at).toLocaleDateString()}`}
                  {r.expires_at && ` · expires ${new Date(r.expires_at).toLocaleDateString()}`}
                </p>
              </div>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={r.active} onChange={(e) => toggle(r.id, e.target.checked)} /> Active
              </label>
              <button onClick={() => remove(r.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
          {rows && rows.length === 0 && <p className="text-sm text-muted-foreground">No codes yet.</p>}
        </ul>
      </div>
    </div>
  );
}