import { createFileRoute, Link } from "@tanstack/react-router";
import { askConfirm } from "@/lib/confirm";
import { AdminNav } from "@/components/admin-nav";
import { RequireRole } from "@/components/require-role";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAccounts,
  createAccount,
  updateAccount,
  regenerateAccountCode,
  getAccountStatement,
  settleAccount,
  recordAccountPayment,
  deleteAccountPayment,
} from "@/lib/accounts.functions";
import { money } from "@/lib/format";
import { buildStatementPdf } from "@/lib/account-statement-pdf";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  Printer,
  CheckCircle2,
  Plus,
  FileDown,
  Trash2,
  Banknote,
} from "lucide-react";

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
  return (
    <RequireRole roles={["admin"]} next="/admin/accounts">
      <AccountsManager />
    </RequireRole>
  );
}

function AccountsManager() {
  const list = useServerFn(listAccounts);
  const create = useServerFn(createAccount);
  const update = useServerFn(updateAccount);
  const regen = useServerFn(regenerateAccountCode);
  const [rows, setRows] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Account | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function refresh() {
    try {
      setRows(await list());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    }
  }
  useEffect(() => {
    void refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-secondary/40">
      <AdminNav />
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/staff" className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="font-display text-xl font-bold">Tab accounts</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-brand"
          >
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
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No tab accounts yet. Create one to get started.
                  </td>
                </tr>
              )}
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-secondary/30">
                  <td className="p-3 font-semibold">
                    {a.name}
                    {a.contact_name && (
                      <div className="text-xs font-normal text-muted-foreground">
                        {a.contact_name}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-sm text-muted-foreground"
                        title="Codes are stored hashed and shown once when generated"
                      >
                        •••• hidden
                      </span>
                      <button
                        onClick={async () => {
                          if (
                            !(await askConfirm(
                              "Generate a new code? The old one will stop working immediately.",
                            ))
                          )
                            return;
                          const res = await regen({ data: { id: a.id } });
                          toast.success(`New code: ${res.code}`);
                          void refresh();
                        }}
                        className="text-muted-foreground hover:text-primary"
                        title="Regenerate"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {a.contact_email && <div>{a.contact_email}</div>}
                    {a.contact_phone && <div>{a.contact_phone}</div>}
                  </td>
                  <td className="p-3 text-right font-semibold">{money(a.outstanding_cents)}</td>
                  <td className="p-3">
                    <button
                      onClick={async () => {
                        await update({ data: { id: a.id, active: !a.active } });
                        void refresh();
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${a.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      {a.active ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setSelected(a)}
                      className="font-semibold text-primary hover:underline"
                    >
                      View bill →
                    </button>
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
          onCreated={(a) => {
            setShowCreate(false);
            toast.success(`Tab created — code ${a.access_code}`);
            void refresh();
          }}
          create={create}
        />
      )}
      {selected && (
        <StatementModal
          account={selected}
          onClose={() => setSelected(null)}
          onSettled={() => {
            setSelected(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateAccountModal({
  onClose,
  onCreated,
  create,
}: {
  onClose: () => void;
  onCreated: (a: { access_code: string }) => void;
  create: ReturnType<typeof useServerFn<typeof createAccount>>;
}) {
  const [form, setForm] = useState({
    name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    credit_limit: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const limit = form.credit_limit ? Math.round(parseFloat(form.credit_limit) * 100) : undefined;
      const acc = await create({
        data: {
          name: form.name,
          contact_name: form.contact_name || undefined,
          contact_email: form.contact_email || undefined,
          contact_phone: form.contact_phone || undefined,
          credit_limit_cents: limit,
          notes: form.notes || undefined,
        },
      });
      onCreated(acc as { access_code: string });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-3 rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <h2 className="font-display text-xl font-bold">New tab account</h2>
        <input
          required
          placeholder="Business / account name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-11 w-full rounded-xl border border-border bg-background px-4"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Contact person"
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            className="h-11 rounded-xl border border-border bg-background px-4"
          />
          <input
            placeholder="Phone"
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            className="h-11 rounded-xl border border-border bg-background px-4"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            className="h-11 rounded-xl border border-border bg-background px-4 sm:col-span-2"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Credit limit £ (optional)"
            value={form.credit_limit}
            onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
            className="h-11 rounded-xl border border-border bg-background px-4 sm:col-span-2"
          />
          <textarea
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="min-h-20 rounded-xl border border-border bg-background p-3 sm:col-span-2"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full border border-border px-4 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-brand disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create tab"}
          </button>
        </div>
      </form>
    </div>
  );
}

function StatementModal({
  account,
  onClose,
  onSettled,
}: {
  account: Account;
  onClose: () => void;
  onSettled: () => void;
}) {
  const load = useServerFn(getAccountStatement);
  const settle = useServerFn(settleAccount);
  const pay = useServerFn(recordAccountPayment);
  const delPay = useServerFn(deleteAccountPayment);
  const [data, setData] = useState<Statement | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", method: "bank_transfer", reference: "" });
  const [busy, setBusy] = useState(false);

  async function reload() {
    setData(await load({ data: { account_id: account.id } }));
  }
  useEffect(() => {
    void reload();
  }, [account.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data)
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
        <div className="rounded-2xl bg-card p-8">Loading…</div>
      </div>
    );

  const onTab = data.orders.filter((o) => o.payment_status === "on_account");
  const paid = data.orders.filter((o) => o.payment_status !== "on_account");
  const charges = onTab.reduce((s, o) => s + o.total_cents, 0);
  const unsettledPayments = data.payments.filter((p) => !p.settled_at);
  const paidOff = unsettledPayments.reduce((s, p) => s + p.amount_cents, 0);
  const outstanding = Math.max(charges - paidOff, 0);
  const itemsByOrder = new Map<string, typeof data.items>();
  for (const it of data.items) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push(it);
    itemsByOrder.set(it.order_id, arr);
  }

  async function doSettle() {
    if (!(await askConfirm(`Mark the remaining ${money(outstanding)} of tab charges as paid?`)))
      return;
    try {
      await settle({ data: { account_id: account.id } });
      toast.success("Tab settled");
      onSettled();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Settle failed");
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(payForm.amount || "0") * 100);
    if (!cents || cents <= 0) {
      toast.error("Enter an amount");
      return;
    }
    setBusy(true);
    try {
      await pay({
        data: {
          account_id: account.id,
          amount_cents: cents,
          method: payForm.method as "cash" | "card" | "bank_transfer" | "other",
          reference: payForm.reference || undefined,
        },
      });
      toast.success(`Payment of ${money(cents)} recorded`);
      setPayForm({ amount: "", method: "bank_transfer", reference: "" });
      setPayOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record payment");
    } finally {
      setBusy(false);
    }
  }

  function downloadPdf() {
    buildStatementPdf({
      account,
      orders: data!.orders,
      items: data!.items,
      payments: unsettledPayments,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 print:static print:bg-white"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-border bg-card p-8 shadow-2xl print:max-h-none print:w-full print:overflow-visible print:border-0 print:shadow-none"
      >
        <div className="flex items-start justify-between gap-4 print:block">
          <div>
            <p className="font-display text-2xl font-bold">Cafe1 · Tab statement</p>
            <p className="mt-1 font-semibold">{account.name}</p>
            {account.contact_name && (
              <p className="text-sm text-muted-foreground">{account.contact_name}</p>
            )}
            {account.contact_email && (
              <p className="text-sm text-muted-foreground">{account.contact_email}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">{new Date().toLocaleDateString()}</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={downloadPdf}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:border-primary hover:text-primary"
            >
              <FileDown className="h-4 w-4" />
              PDF
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:border-primary hover:text-primary"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            {outstanding > 0 && (
              <button
                onClick={() => setPayOpen((v) => !v)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:border-primary hover:text-primary"
              >
                <Banknote className="h-4 w-4" />
                Record payment
              </button>
            )}
            {outstanding > 0 && (
              <button
                onClick={doSettle}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-brand"
              >
                <CheckCircle2 className="h-4 w-4" />
                Settle {money(outstanding)}
              </button>
            )}
          </div>
        </div>

        {payOpen && (
          <form
            onSubmit={submitPayment}
            className="mt-4 grid gap-2 rounded-xl border border-border bg-secondary/40 p-4 sm:grid-cols-4 print:hidden"
          >
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              autoFocus
              placeholder="Amount £"
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            />
            <select
              value={payForm.method}
              onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
            <input
              placeholder="Reference (optional)"
              value={payForm.reference}
              onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            />
            <button
              disabled={busy}
              className="h-10 rounded-full bg-foreground text-sm font-semibold text-background disabled:opacity-60"
            >
              {busy ? "Saving…" : "Add part-payment"}
            </button>
          </form>
        )}

        <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Charges on tab</span>
            <span>{money(charges)}</span>
          </div>
          {paidOff > 0 && (
            <div className="mt-1 flex justify-between text-muted-foreground">
              <span>Payments received</span>
              <span>− {money(paidOff)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-primary/20 pt-2">
            <span className="font-semibold">Balance due</span>
            <span className="font-display text-xl font-bold text-primary">
              {money(outstanding)}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-muted-foreground">
            <span>{onTab.length} unsettled orders</span>
            {account.credit_limit_cents ? (
              <span>Credit limit {money(account.credit_limit_cents)}</span>
            ) : null}
          </div>
        </div>

        {unsettledPayments.length > 0 && (
          <section className="mt-6">
            <h3 className="font-display text-lg font-bold">Payments received</h3>
            <ul className="mt-2 divide-y divide-border text-sm">
              {unsettledPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span>
                    {new Date(p.created_at).toLocaleDateString()} · {p.method.replace("_", " ")}
                    {p.reference && <span className="text-muted-foreground"> · {p.reference}</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold">− {money(p.amount_cents)}</span>
                    <button
                      className="text-muted-foreground hover:text-primary print:hidden"
                      title="Remove payment"
                      onClick={async () => {
                        if (!(await askConfirm("Remove this payment record?"))) return;
                        try {
                          await delPay({ data: { id: p.id } });
                          await reload();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Delete failed");
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6">
          <h3 className="font-display text-lg font-bold">Unsettled charges</h3>
          {onTab.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">Nothing outstanding.</p>
          )}
          {onTab.map((o) => (
            <div key={o.id} className="mt-3 rounded-xl border border-border p-4 text-sm">
              <div className="flex justify-between font-semibold">
                <span>
                  #{o.order_number} · {new Date(o.created_at).toLocaleString()}
                </span>
                <span>{money(o.total_cents)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {o.customer_name} · {o.type}
              </div>
              <ul className="mt-2 divide-y divide-border text-xs">
                {(itemsByOrder.get(o.id) ?? []).map((it, idx) => (
                  <li key={idx} className="flex justify-between py-1">
                    <span>
                      {it.qty} × {it.name}
                    </span>
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
                  <span>
                    #{o.order_number} · {new Date(o.created_at).toLocaleDateString()}
                  </span>
                  <span className="text-muted-foreground">
                    {money(o.total_cents)} · {o.payment_status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
