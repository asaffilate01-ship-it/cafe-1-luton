import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminNav } from "@/components/admin-nav";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAccounts,
  createAccount,
  updateAccount,
  regenerateAccountCode,
  getAccountStatement,
  settleAccount,
} from "@/lib/accounts.functions";
import { useSession, useRoles } from "@/hooks/use-auth";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Copy, RefreshCw, Printer, CheckCircle2, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/accounts")({
  head: () => ({
    meta: [
      { title: "Tab accounts — Cafe1" },
      { name: "description", content: "Manage business tabs, access codes and settlements." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountsAdmin,
});

type Account = Awaited<ReturnType<typeof listAccounts>>[number];
type Statement = Awaited<ReturnType<typeof getAccountStatement>>;

function AccountsAdmin() {
  const { user, loading } = useSession();
  const { roles } = useRoles(user);
  const navigate = useNavigate();
  const list = useServerFn(listAccounts);
  const create = useServerFn(createAccount);
  const update = useServerFn(updateAccount);
  const regen = useServerFn(regenerateAccountCode);
  const [rows, setRows] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Account | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !(roles.includes("admin") || roles.includes("staff"))) {
      navigate({ to: "/admin/login", search: { next: "/admin/accounts" } });
    }
  }, [user, roles, loading, navigate]);

  async function refresh() {
    try { setRows(await list()); } catch (e) { toast.error(e instanceof Error ? e.message : "Load failed"); }
  }
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  return (
    <div className="min-h-screen bg-secondary/40">
      <AdminNav />
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/staff" className="text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /></Link>
            <h1 className="font-display text-xl font-bold">Tab accounts</h1>
          </div>
          <button onClick={() => setShowCreate(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-brand">
            <Plus className="h-4 w-4" /> New account
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Account</th>
                <th className="p-3">Code</th>
                <th className="p-3">Contact</th>
                <th className="p-3 text-right">Outstanding</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No tab accounts yet. Create one to get started.</td></tr>
              )}
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-secondary/30">
                  <td className="p-3 font-semibold">{a.name}{a.contact_name && <div className="text-xs font-normal text-muted-foreground">{a.contact_name}</div>}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold tracking-widest text-primary">{a.access_code}</span>
                      <button onClick={() => { navigator.clipboard.writeText(a.access_code); toast.success("Code copied"); }} className="text-muted-foreground hover:text-primary" title="Copy"><Copy className="h-3.5 w-3.5" /></button>
                      <button
                        onClick={async () => {
                          if (!confirm("Generate a new code? The old one will stop working immediately.")) return;
                          const res = await regen({ data: { id: a.id } });
                          toast.success(`New code: ${res.code}`);
                          void refresh();
                        }}
                        className="text-muted-foreground hover:text-primary" title="Regenerate"
                      ><RefreshCw className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {a.contact_email && <div>{a.contact_email}</div>}
                    {a.contact_phone && <div>{a.contact_phone}</div>}
                  </td>
                  <td className="p-3 text-right font-semibold">{money(a.outstanding_cents)}</td>
                  <td className="p-3">
                    <button
                      onClick={async () => { await update({ data: { id: a.id, active: !a.active } }); void refresh(); }}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${a.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >{a.active ? "Active" : "Disabled"}</button>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => setSelected(a)} className="font-semibold text-primary hover:underline">View bill →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateAccountModal
          onClose={() => setShowCreate(false)}
          onCreated={(a) => { setShowCreate(false); toast.success(`Tab created — code ${a.access_code}`); void refresh(); }}
          create={create}
        />
      )}
      {selected && (
        <StatementModal account={selected} onClose={() => setSelected(null)} onSettled={() => { setSelected(null); void refresh(); }} />
      )}
    </div>
  );
}

function CreateAccountModal({ onClose, onCreated, create }: { onClose: () => void; onCreated: (a: { access_code: string }) => void; create: ReturnType<typeof useServerFn<typeof createAccount>> }) {
  const [form, setForm] = useState({ name: "", contact_name: "", contact_email: "", contact_phone: "", credit_limit: "", notes: "" });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const limit = form.credit_limit ? Math.round(parseFloat(form.credit_limit) * 100) : undefined;
      const acc = await create({ data: {
        name: form.name,
        contact_name: form.contact_name || undefined,
        contact_email: form.contact_email || undefined,
        contact_phone: form.contact_phone || undefined,
        credit_limit_cents: limit,
        notes: form.notes || undefined,
      } });
      onCreated(acc as { access_code: string });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Create failed"); }
    finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-3 rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="font-display text-xl font-bold">New tab account</h2>
        <input required placeholder="Business / account name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 w-full rounded-xl border border-border bg-background px-4" />
        <div className="grid gap-3 sm:grid-cols-2">
          <input placeholder="Contact person" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
          <input placeholder="Phone" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4" />
          <input type="email" placeholder="Email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4 sm:col-span-2" />
          <input type="number" min="0" step="0.01" placeholder="Credit limit £ (optional)" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} className="h-11 rounded-xl border border-border bg-background px-4 sm:col-span-2" />
          <textarea placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-20 rounded-xl border border-border bg-background p-3 sm:col-span-2" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border border-border px-4 text-sm font-semibold">Cancel</button>
          <button disabled={busy} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-brand disabled:opacity-60">{busy ? "Creating…" : "Create tab"}</button>
        </div>
      </form>
    </div>
  );
}

function StatementModal({ account, onClose, onSettled }: { account: Account; onClose: () => void; onSettled: () => void }) {
  const load = useServerFn(getAccountStatement);
  const settle = useServerFn(settleAccount);
  const [data, setData] = useState<Statement | null>(null);
  useEffect(() => { (async () => setData(await load({ data: { account_id: account.id } })))(); }, [account.id, load]);

  if (!data) return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="rounded-2xl bg-card p-8">Loading…</div>
    </div>
  );

  const onTab = data.orders.filter((o) => o.payment_status === "on_account");
  const paid = data.orders.filter((o) => o.payment_status !== "on_account");
  const outstanding = onTab.reduce((s, o) => s + o.total_cents, 0);
  const itemsByOrder = new Map<string, typeof data.items>();
  for (const it of data.items) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push(it); itemsByOrder.set(it.order_id, arr);
  }

  async function doSettle() {
    if (!confirm(`Mark ${money(outstanding)} of tab charges as paid?`)) return;
    try {
      await settle({ data: { account_id: account.id } });
      toast.success("Tab settled");
      onSettled();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Settle failed"); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 print:static print:bg-white" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-border bg-card p-8 shadow-2xl print:max-h-none print:w-full print:overflow-visible print:border-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4 print:block">
          <div>
            <p className="font-display text-2xl font-bold">Cafe1 · Tab statement</p>
            <p className="mt-1 font-semibold">{account.name}</p>
            {account.contact_name && <p className="text-sm text-muted-foreground">{account.contact_name}</p>}
            {account.contact_email && <p className="text-sm text-muted-foreground">{account.contact_email}</p>}
            <p className="mt-1 text-sm text-muted-foreground">Code <span className="font-mono">{account.access_code}</span> · {new Date().toLocaleDateString()}</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:border-primary hover:text-primary"><Printer className="h-4 w-4" />Print</button>
            {outstanding > 0 && (
              <button onClick={doSettle} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-brand"><CheckCircle2 className="h-4 w-4" />Settle {money(outstanding)}</button>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <div className="flex justify-between"><span>Outstanding balance</span><span className="font-display text-xl font-bold text-primary">{money(outstanding)}</span></div>
          <div className="mt-1 flex justify-between text-muted-foreground"><span>{onTab.length} unsettled orders</span>{account.credit_limit_cents ? <span>Credit limit {money(account.credit_limit_cents)}</span> : null}</div>
        </div>

        <section className="mt-6">
          <h3 className="font-display text-lg font-bold">Unsettled charges</h3>
          {onTab.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing outstanding.</p>}
          {onTab.map((o) => (
            <div key={o.id} className="mt-3 rounded-xl border border-border p-4 text-sm">
              <div className="flex justify-between font-semibold">
                <span>#{o.order_number} · {new Date(o.created_at).toLocaleString()}</span>
                <span>{money(o.total_cents)}</span>
              </div>
              <div className="text-xs text-muted-foreground">{o.customer_name} · {o.type}</div>
              <ul className="mt-2 divide-y divide-border text-xs">
                {(itemsByOrder.get(o.id) ?? []).map((it, idx) => (
                  <li key={idx} className="flex justify-between py-1">
                    <span>{it.qty} × {it.name}</span>
                    <span>{money(it.qty * it.unit_price_cents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {paid.length > 0 && (
          <section className="mt-6">
            <h3 className="font-display text-lg font-bold">Previously settled</h3>
            <ul className="mt-2 divide-y divide-border text-sm">
              {paid.map((o) => (
                <li key={o.id} className="flex justify-between py-2">
                  <span>#{o.order_number} · {new Date(o.created_at).toLocaleDateString()}</span>
                  <span className="text-muted-foreground">{money(o.total_cents)} · {o.payment_status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}