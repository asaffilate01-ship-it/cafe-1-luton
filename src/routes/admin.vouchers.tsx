import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { askConfirm } from "@/lib/confirm";
import { AdminNav } from "@/components/admin-nav";
import { useEffect, useMemo, useState } from "react";
import { useSession, useRoles } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { Ticket, Trash2, Download, CalendarPlus, Power, ShieldCheck } from "lucide-react";
import { QrCode } from "@/components/qr-code";
import {
  JUROR_DAILY_ALLOWANCE_CENTS,
  JUROR_DEFAULT_SERVICE_DAYS,
  addWorkingDays,
  isoDate,
} from "@/lib/juror";

export const Route = createFileRoute("/admin/vouchers")({
  head: () => ({
    meta: [
      { title: "Juror vouchers — Cafe1 Admin" },
      {
        name: "description",
        content:
          "Issue, extend and reconcile anonymous HMCTS juror voucher codes, and export weekly reimbursement reports for Cafe1.",
      },
      { property: "og:title", content: "Juror vouchers — Cafe1 Admin" },
      {
        property: "og:description",
        content:
          "Issue, extend and reconcile anonymous HMCTS juror voucher codes, and export weekly reimbursement reports for Cafe1.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminVouchers,
});

type Holder = {
  id: string;
  code: string;
  batch: string | null;
  active: boolean;
  daily_amount_cents: number;
  valid_from: string;
  valid_until: string | null;
  opted_in_at: string | null;
  opt_in_source: string | null;
  jury_room: string | null;
  notes: string | null;
};
type Redemption = {
  id: string;
  holder_id: string;
  for_date: string;
  amount_cents: number;
  created_at: string;
  orders: { order_number: number } | null;
};
type VoucherEvent = {
  id: string;
  code: string;
  event: string;
  detail: string | null;
  amount_cents: number | null;
  created_at: string;
};

function today() {
  return isoDate(new Date());
}
function weekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return isoDate(d);
}

function statusOf(h: Holder, day: string): { label: string; tone: string } {
  if (!h.active) return { label: "Deactivated", tone: "bg-muted text-muted-foreground" };
  if (day < h.valid_from) return { label: "Not started", tone: "bg-amber-100 text-amber-700" };
  if (h.valid_until && day > h.valid_until)
    return { label: "Expired", tone: "bg-muted text-muted-foreground" };
  if (h.opted_in_at) return { label: "Opted in", tone: "bg-emerald-100 text-emerald-700" };
  return { label: "Issued", tone: "bg-primary-soft text-primary" };
}

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
  const [search, setSearch] = useState("");

  const { data: holders } = useQuery({
    queryKey: ["voucher-holders"],
    enabled: !!user && allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voucher_holders")
        .select(
          "id, code, batch, active, daily_amount_cents, valid_from, valid_until, opted_in_at, opt_in_source, jury_room, notes",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Holder[];
    },
  });

  const { data: usedToday } = useQuery({
    queryKey: ["voucher-used", date],
    enabled: !!user && allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voucher_redemptions")
        .select("holder_id, amount_cents")
        .eq("for_date", date);
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

  const { data: events } = useQuery({
    queryKey: ["voucher-events"],
    enabled: !!user && allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voucher_events")
        .select("id, code, event, detail, amount_cents, created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as VoucherEvent[];
    },
  });

  const byId = useMemo(() => Object.fromEntries((holders ?? []).map((h) => [h.id, h])), [holders]);
  const reportTotal = (report ?? []).reduce((s, r) => s + r.amount_cents, 0);
  const visible = useMemo(() => {
    const q = search.trim().toUpperCase();
    return (holders ?? []).filter(
      (h) => !q || h.code.includes(q) || (h.batch ?? "").toUpperCase().includes(q),
    );
  }, [holders, search]);

  /* ---------------- issuing ---------------- */
  const [genCount, setGenCount] = useState("20");
  const [batch, setBatch] = useState(`Induction ${today()}`);
  const [validFrom, setValidFrom] = useState(today());
  const [serviceDays, setServiceDays] = useState(String(JUROR_DEFAULT_SERVICE_DAYS));
  const [allowance, setAllowance] = useState((JUROR_DAILY_ALLOWANCE_CENTS / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<string[]>([]);
  const [slips, setSlips] = useState<string[]>([]);

  const slipUrl = (code: string) =>
    `https://cafe1stalbans.co.uk/juror?code=${encodeURIComponent(code)}&src=slip`;

  // Unambiguous alphabet (no O/0, I/1) — 10 chars ≈ 50 bits of entropy, so
  // juror codes can never be guessed or walked sequentially.
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

  const untilPreview = useMemo(() => {
    const days = Math.min(Math.max(parseInt(serviceDays || "0", 10) || 0, 1), 60);
    return isoDate(addWorkingDays(new Date(`${validFrom}T12:00:00`), days));
  }, [validFrom, serviceDays]);

  async function issueBatch(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.min(Math.max(parseInt(genCount || "0", 10) || 0, 1), 200);
    const cents = Math.round(parseFloat(allowance || "0") * 100);
    if (!Number.isFinite(cents) || cents <= 0) return toast.error("Enter a daily allowance.");
    setBusy(true);
    const codes = generateCodes(n);
    const { error } = await supabase.from("voucher_holders").insert(
      codes.map((code) => ({
        code,
        batch: batch.trim() || null,
        active: true,
        daily_amount_cents: cents,
        valid_from: validFrom,
        valid_until: untilPreview,
      })),
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    setIssued(codes);
    toast.success(`${n} juror code${n === 1 ? "" : "s"} issued and active`);
    qc.invalidateQueries({ queryKey: ["voucher-holders"] });
  }

  function downloadIssued(codes: string[], label: string) {
    const rows = [
      ["Voucher code", "Valid from", "Valid until", "Daily allowance (GBP)", "Batch"],
      ...codes.map((c) => [
        c,
        validFrom,
        untilPreview,
        (parseFloat(allowance) || 0).toFixed(2),
        batch,
      ]),
    ];
    downloadCsv(rows, `cafe1-juror-codes-${label}.csv`);
  }

  function downloadCsv(rows: (string | number)[][], filename: string) {
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------------- lifecycle ---------------- */
  async function extend(h: Holder, days: number) {
    const base =
      h.valid_until && h.valid_until > today() ? new Date(`${h.valid_until}T12:00:00`) : new Date();
    const next = isoDate(addWorkingDays(base, days + 1));
    const { error } = await supabase
      .from("voucher_holders")
      .update({ valid_until: next })
      .eq("id", h.id);
    if (error) return toast.error(error.message);
    await supabase
      .from("voucher_events")
      .insert({ holder_id: h.id, code: h.code, event: "extended", detail: `Valid until ${next}` });
    toast.success(`${h.code} extended to ${next}`);
    qc.invalidateQueries({ queryKey: ["voucher-holders"] });
    qc.invalidateQueries({ queryKey: ["voucher-events"] });
  }

  async function toggleActive(h: Holder) {
    const active = !h.active;
    const { error } = await supabase
      .from("voucher_holders")
      .update({ active, deactivated_at: active ? null : new Date().toISOString() })
      .eq("id", h.id);
    if (error) return toast.error(error.message);
    await supabase
      .from("voucher_events")
      .insert({ holder_id: h.id, code: h.code, event: active ? "reactivated" : "deactivated" });
    qc.invalidateQueries({ queryKey: ["voucher-holders"] });
    qc.invalidateQueries({ queryKey: ["voucher-events"] });
  }

  async function removeHolder(h: Holder) {
    if (
      !(await askConfirm({
        title: `Delete voucher code ${h.code}?`,
        description:
          "This permanently removes the code and its allocations. Deactivate instead if you only want to stop it being used.",
        confirmLabel: "Delete code",
      }))
    )
      return;
    const { error } = await supabase.from("voucher_holders").delete().eq("id", h.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["voucher-holders"] });
  }

  function exportReport() {
    downloadCsv(
      [
        ["Date", "Time", "Voucher code", "Batch", "Order #", "Amount redeemed (GBP)"],
        ...(report ?? []).map((r) => {
          const h = byId[r.holder_id];
          return [
            r.for_date,
            new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            h?.code ?? "",
            h?.batch ?? "",
            r.orders?.order_number ? `#${r.orders.order_number}` : "",
            (r.amount_cents / 100).toFixed(2),
          ];
        }),
        ["", "", "", "", "TOTAL", (reportTotal / 100).toFixed(2)],
      ],
      `cafe1-juror-vouchers-${from}-to-${to}.csv`,
    );
  }

  function exportRegister() {
    downloadCsv(
      [
        [
          "Voucher code",
          "Batch",
          "Status",
          "Valid from",
          "Valid until",
          "Daily allowance (GBP)",
          "Opted in",
        ],
        ...(holders ?? []).map((h) => [
          h.code,
          h.batch ?? "",
          statusOf(h, today()).label,
          h.valid_from,
          h.valid_until ?? "",
          (h.daily_amount_cents / 100).toFixed(2),
          h.opted_in_at ? new Date(h.opted_in_at).toLocaleString() : "",
        ]),
      ],
      `cafe1-juror-code-register-${today()}.csv`,
    );
  }

  if (loading || rl) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (!allowed)
    return <div className="p-10 text-muted-foreground">You don't have access to this page.</div>;

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
            <Ticket className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">Juror voucher scheme</h1>
            <p className="text-sm text-muted-foreground">
              Anonymous HMCTS codes — {money(JUROR_DAILY_ALLOWANCE_CENTS)} each sitting day, unused
              value expires nightly, and Cafe 1 only claims what is redeemed.
            </p>
          </div>
        </div>

        {/* Issue a batch */}
        <form onSubmit={issueBatch} className="mt-8 rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold">Issue codes for an induction</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                How many
              </span>
              <input
                type="number"
                min="1"
                max="200"
                value={genCount}
                onChange={(e) => setGenCount(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Batch label
              </span>
              <input
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Valid from
              </span>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Service days
              </span>
              <input
                type="number"
                min="1"
                max="60"
                value={serviceDays}
                onChange={(e) => setServiceDays(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Daily allowance £
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={allowance}
                onChange={(e) => setAllowance(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              disabled={busy}
              className="h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              Issue &amp; activate codes
            </button>
            <p className="text-xs text-muted-foreground">
              Valid working days {validFrom} → <span className="font-semibold">{untilPreview}</span>
              . Allowance is granted automatically on sitting days — no daily setup.
            </p>
          </div>
          {issued.length > 0 && (
            <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-primary">
                  {issued.length} codes ready for the Jury Officer
                </p>
                <button
                  type="button"
                  onClick={() =>
                    downloadIssued(issued, batch.replace(/\W+/g, "-").toLowerCase() || "batch")
                  }
                  className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  <Download className="h-4 w-4" /> Download list
                </button>
                <button
                  type="button"
                  onClick={() => setSlips(issued)}
                  className="flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted"
                >
                  <Ticket className="h-4 w-4" /> Print QR slips
                </button>
              </div>
              <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-background p-3 font-mono text-xs">
                {issued.join("\n")}
              </pre>
            </div>
          )}
        </form>

        {/* Register */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">Voucher register</p>
            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or batch"
                className="h-10 w-48 rounded-xl border border-border bg-background px-3 text-sm"
              />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              />
              <button
                onClick={exportRegister}
                className="flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted"
              >
                <Download className="h-4 w-4" /> Register
              </button>
            </div>
          </div>
          <div className="mt-4 divide-y divide-border">
            {visible.map((h) => {
              const used = usedToday?.[h.id] ?? 0;
              const st = statusOf(h, date);
              const grants =
                h.active && date >= h.valid_from && (!h.valid_until || date <= h.valid_until);
              const left = grants ? Math.max(0, h.daily_amount_cents - used) : 0;
              return (
                <div key={h.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-[200px] flex-1">
                    <p className="font-mono font-semibold">{h.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.batch ? `${h.batch} · ` : ""}
                      {h.valid_from} → {h.valid_until ?? "open"}
                      {h.jury_room ? ` · ${h.jury_room}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${st.tone}`}>
                    {st.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {money(h.daily_amount_cents)}/day · used {money(used)} · left{" "}
                    <span className="font-semibold text-primary">{money(left)}</span>
                  </span>
                  <button
                    onClick={() => extend(h, 5)}
                    className="rounded-lg p-2 text-muted-foreground hover:text-primary"
                    aria-label={`Extend ${h.code} by 5 working days`}
                    title="Extend 5 working days"
                  >
                    <CalendarPlus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setSlips([h.code])}
                    className="rounded-lg p-2 text-muted-foreground hover:text-primary"
                    aria-label={`Print QR slip for ${h.code}`}
                    title="Print QR slip"
                  >
                    <Ticket className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(h)}
                    className={`rounded-lg p-2 ${h.active ? "text-muted-foreground hover:text-destructive" : "text-emerald-600"}`}
                    aria-label={`${h.active ? "Deactivate" : "Reactivate"} ${h.code}`}
                    title={h.active ? "Deactivate" : "Reactivate"}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => removeHolder(h)}
                    className="rounded-lg p-2 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${h.code}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            {!visible.length && (
              <p className="py-6 text-sm text-muted-foreground">
                No voucher codes yet — issue a batch above.
              </p>
            )}
          </div>
        </div>

        {/* Reimbursement */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">HMCTS reimbursement claim</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              />
              <span className="text-muted-foreground">→</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              />
              <button
                onClick={exportReport}
                className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                <Download className="h-4 w-4" /> CSV
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Date &amp; time</th>
                  <th>Code</th>
                  <th>Batch</th>
                  <th>Order</th>
                  <th className="text-right">Redeemed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(report ?? []).map((r) => {
                  const h = byId[r.holder_id];
                  return (
                    <tr key={r.id}>
                      <td className="py-2">
                        {r.for_date}{" "}
                        {new Date(r.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="font-mono">{h?.code ?? "—"}</td>
                      <td className="text-muted-foreground">{h?.batch ?? "—"}</td>
                      <td>{r.orders?.order_number ? `#${r.orders.order_number}` : "—"}</td>
                      <td className="text-right font-semibold">{money(r.amount_cents)}</td>
                    </tr>
                  );
                })}
                {!(report ?? []).length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-muted-foreground">
                      No vouchers redeemed in this period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-display text-base font-bold">
                  <td className="pt-3" colSpan={4}>
                    Total to reclaim
                  </td>
                  <td className="pt-3 text-right text-primary">{money(reportTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Audit trail */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" /> Audit trail
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every issue, opt-in, redemption and extension — anonymous codes only, no personal data.
          </p>
          <div className="mt-4 divide-y divide-border text-sm">
            {(events ?? []).map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="w-40 text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </span>
                <span className="font-mono">{e.code}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold uppercase">
                  {e.event}
                </span>
                {e.amount_cents != null && (
                  <span className="font-semibold text-primary">{money(e.amount_cents)}</span>
                )}
                {e.detail && <span className="text-xs text-muted-foreground">{e.detail}</span>}
              </div>
            ))}
            {!(events ?? []).length && (
              <p className="py-6 text-muted-foreground">No activity yet.</p>
            )}
          </div>
        </div>
      </div>

      {slips.length > 0 && (
        <div className="fixed inset-0 z-50 overflow-auto bg-background p-6 print:p-0">
          <style>{`@media print { .no-print { display: none !important; } }`}</style>
          <div className="no-print mx-auto mb-6 flex max-w-4xl flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">
              {slips.length} juror QR slip{slips.length === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                Print
              </button>
              <button
                onClick={() => setSlips([])}
                className="h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3">
            {slips.map((c) => (
              <div
                key={c}
                className="break-inside-avoid rounded-xl border border-border p-4 text-center"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                  Café 1 juror voucher
                </p>
                <div className="mt-2 flex justify-center">
                  <QrCode value={slipUrl(c)} size={150} alt={`QR code for juror voucher ${c}`} />
                </div>
                <p className="mt-2 font-mono text-sm font-bold">{c}</p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                  Scan to check your daily {money(JUROR_DAILY_ALLOWANCE_CENTS)} allowance, or give
                  this code at the till.
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
