import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminNav } from "@/components/admin-nav";
import { useEffect, useMemo, useState } from "react";
import { useSession, useRoles } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { Ticket, Trash2, Download } from "lucide-react";

export const Route = createFileRoute("/admin/vouchers")({
  head: () => ({
    meta: [
      { title: "Court vouchers — Cafe1 Admin" },
      { name: "description", content: "Manage daily court voucher allowances and export weekly reimbursement reports for Cafe1." },
      { property: "og:title", content: "Court vouchers — Cafe1 Admin" },
      { property: "og:description", content: "Manage daily court voucher allowances and export weekly reimbursement reports for Cafe1." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminVouchers,
});

type Holder = { id: string; code: string; name: string | null; notes: string | null; active: boolean };
type Allocation = { id: string; holder_id: string; for_date: string; amount_cents: number; notes: string | null };
type Redemption = {
  id: string; holder_id: string; for_date: string; amount_cents: number; created_at: string;
  orders: { order_number: number } | null;
};

function today() { return new Date().toISOString().slice(0, 10); }
function weekAgo() { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); }

function AdminVouchers() {
  const { user, loading } = useSession();
  const { has, loading: rl } = useRoles(user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/admin/login", search: { next: "/admin/vouchers" } });
  }, [loading, user, navigate]);
  const allowed = has("admin") || has("staff");

  const [date, setDate] = useState(today());
  const [from, setFrom] = useState(weekAgo());
  const [to, setTo] = useState(today());

  const { data: holders } = useQuery({
    queryKey: ["voucher-holders"],
    enabled: !!user && allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("voucher_holders").select("*").order("code");
      if (error) throw error;
      return (data ?? []) as Holder[];
    },
  });

  const { data: allocations } = useQuery({
    queryKey: ["voucher-allocations", date],
    enabled: !!user && allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("voucher_allocations").select("*").eq("for_date", date);
      if (error) throw error;
      return (data ?? []) as Allocation[];
    },
  });

  const { data: usedToday } = useQuery({
    queryKey: ["voucher-used", date],
    enabled: !!user && allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("voucher_redemptions").select("holder_id, amount_cents").eq("for_date", date);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.holder_id] = (map[r.holder_id] ?? 0) + r.amount_cents;
      return map;
    },
  });

  const { data: report } = useQuery({
    queryKey: ["voucher-report", from, to],
    enabled: !!user && allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voucher_redemptions")
        .select("id, holder_id, for_date, amount_cents, created_at, orders(order_number)")
        .gte("for_date", from)
        .lte("for_date", to)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Redemption[];
    },
  });

  const byId = useMemo(() => Object.fromEntries((holders ?? []).map((h) => [h.id, h])), [holders]);
  const reportTotal = (report ?? []).reduce((s, r) => s + r.amount_cents, 0);

  const [bulkCodes, setBulkCodes] = useState("");
  const [defaultAllowance, setDefaultAllowance] = useState("15.00");
  const [busy, setBusy] = useState(false);
  const [genCount, setGenCount] = useState("20");

  // Unambiguous alphabet (no O/0, I/1) — 10 chars ≈ 50 bits of entropy, so
  // court codes can never be guessed or walked sequentially.
  function generateCodes(n: number): string[] {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const out = new Set<string>();
    while (out.size < n) {
      const bytes = new Uint8Array(10);
      crypto.getRandomValues(bytes);
      const raw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
      out.add(`CV-${raw.slice(0, 5)}-${raw.slice(5)}`);
    }
    return Array.from(out);
  }

  function addGenerated() {
    const n = Math.min(Math.max(parseInt(genCount || "0", 10) || 0, 1), 200);
    const codes = generateCodes(n);
    setBulkCodes((prev) => (prev.trim() ? `${prev.trim()}\n` : "") + codes.join("\n"));
    toast.success(`${n} secure code${n === 1 ? "" : "s"} generated — review, then activate`);
  }

  async function addCodes(e: React.FormEvent) {
    e.preventDefault();
    const codes = Array.from(new Set(
      bulkCodes.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean),
    ));
    if (!codes.length) return toast.error("Paste at least one code.");
    const weak = codes.filter((c) => c.replace(/[^A-Z0-9]/g, "").length < 8);
    if (weak.length) {
      return toast.error(`Codes must be at least 8 characters: ${weak.slice(0, 3).join(", ")}${weak.length > 3 ? "…" : ""}`);
    }
    setBusy(true);
    const { error } = await supabase
      .from("voucher_holders")
      .upsert(codes.map((code) => ({ code, active: true })), { onConflict: "code", ignoreDuplicates: true });
    if (error) { setBusy(false); return toast.error(error.message); }
    // Set today's default allowance for every pasted code (new or existing).
    const cents = Math.round(parseFloat(defaultAllowance || "0") * 100);
    if (Number.isFinite(cents) && cents > 0) {
      const { data: all, error: selErr } = await supabase.from("voucher_holders").select("id, code").in("code", codes);
      if (selErr) { setBusy(false); return toast.error(selErr.message); }
      const rows = (all ?? []).map((h) => ({ holder_id: h.id, for_date: date, amount_cents: cents }));
      if (rows.length) {
        const { error: allocErr } = await supabase
          .from("voucher_allocations")
          .upsert(rows, { onConflict: "holder_id,for_date" });
        if (allocErr) { setBusy(false); return toast.error(allocErr.message); }
      }
    }
    setBusy(false);
    toast.success(`${codes.length} code${codes.length === 1 ? "" : "s"} activated`);
    setBulkCodes("");
    qc.invalidateQueries({ queryKey: ["voucher-holders"] });
    qc.invalidateQueries({ queryKey: ["voucher-allocations", date] });
  }

  async function setAllowance(holder_id: string, pounds: string) {
    const amount_cents = Math.round(parseFloat(pounds || "0") * 100);
    if (!Number.isFinite(amount_cents) || amount_cents < 0) return;
    const { error } = await supabase
      .from("voucher_allocations")
      .upsert({ holder_id, for_date: date, amount_cents }, { onConflict: "holder_id,for_date" });
    if (error) return toast.error(error.message);
    toast.success("Allowance saved");
    qc.invalidateQueries({ queryKey: ["voucher-allocations", date] });
  }

  async function removeHolder(id: string) {
    const { error } = await supabase.from("voucher_holders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["voucher-holders"] });
  }

  function exportCsv() {
    const rows = [
      ["Date", "Time", "Code", "Order #", "Voucher amount (GBP)"],
      ...(report ?? []).map((r) => {
        const h = byId[r.holder_id];
        return [
          r.for_date,
          new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          h?.code ?? "",
          r.orders?.order_number ? `#${r.orders.order_number}` : "",
          (r.amount_cents / 100).toFixed(2),
        ];
      }),
      ["", "", "", "TOTAL", (reportTotal / 100).toFixed(2)],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cafe1-court-vouchers-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || rl) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (!allowed) return <div className="p-10 text-muted-foreground">You don't have access to this page.</div>;

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary"><Ticket className="h-5 w-5" /></span>
          <div>
            <h1 className="font-display text-3xl font-bold">Court vouchers</h1>
            <p className="text-sm text-muted-foreground">Anonymous court-issued codes. Paste the week's codes, set today's allowance, and the customer enters their code at checkout.</p>
          </div>
        </div>

        <form onSubmit={addCodes} className="mt-8 grid gap-3 rounded-2xl border border-border bg-card p-5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paste voucher codes (one per line, or comma separated)</label>
          <textarea value={bulkCodes} onChange={(e) => setBulkCodes(e.target.value)} rows={4} placeholder={"COURT-A1B2\nCOURT-C3D4"} className="rounded-xl border border-border bg-background p-3 font-mono text-sm uppercase" />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Today's allowance £</span>
              <input type="number" step="0.01" min="0" value={defaultAllowance} onChange={(e) => setDefaultAllowance(e.target.value)} className="h-10 w-24 rounded-xl border border-border bg-background px-3 text-sm" />
            </label>
            <button disabled={busy} className="h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">Activate codes</button>
          </div>
        </form>

        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">Allowances for</p>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm" />
          </div>
          <div className="mt-4 divide-y divide-border">
            {(holders ?? []).map((h) => {
              const alloc = (allocations ?? []).find((a) => a.holder_id === h.id);
              const used = usedToday?.[h.id] ?? 0;
              const left = Math.max(0, (alloc?.amount_cents ?? 0) - used);
              return (
                <div key={h.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-[180px] flex-1">
                    <p className="font-mono font-semibold">{h.code}</p>
                    {h.notes && <p className="text-xs text-muted-foreground">{h.notes}</p>}
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">£</span>
                    <input
                      type="number" step="0.01" min="0"
                      defaultValue={((alloc?.amount_cents ?? 0) / 100).toFixed(2)}
                      onBlur={(e) => setAllowance(h.id, e.target.value)}
                      className="h-10 w-24 rounded-xl border border-border bg-background px-3 text-sm"
                    />
                  </label>
                  <span className="text-xs text-muted-foreground">used {money(used)} · left <span className="font-semibold text-primary">{money(left)}</span></span>
                  <button onClick={() => removeHolder(h.id)} className="rounded-lg p-2 text-muted-foreground hover:text-destructive" aria-label={`Remove ${h.code}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
            {!(holders ?? []).length && <p className="py-6 text-sm text-muted-foreground">No voucher codes yet.</p>}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">Court reimbursement report</p>
            <div className="flex items-center gap-2">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm" />
              <span className="text-muted-foreground">→</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm" />
              <button onClick={exportCsv} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
                <Download className="h-4 w-4" /> CSV
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Date & time</th><th>Code</th><th>Order</th><th className="text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(report ?? []).map((r) => {
                  const h = byId[r.holder_id];
                  return (
                    <tr key={r.id}>
                      <td className="py-2">{r.for_date} {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="font-mono">{h?.code ?? "—"}</td>
                      <td>{r.orders?.order_number ? `#${r.orders.order_number}` : "—"}</td>
                      <td className="text-right font-semibold">{money(r.amount_cents)}</td>
                    </tr>
                  );
                })}
                {!(report ?? []).length && <tr><td colSpan={4} className="py-6 text-muted-foreground">No vouchers used in this period.</td></tr>}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-display text-base font-bold">
                  <td className="pt-3" colSpan={3}>Total to reclaim</td>
                  <td className="pt-3 text-right text-primary">{money(reportTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
