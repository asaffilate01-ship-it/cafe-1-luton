import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { updateManualOrder } from "@/lib/manual-order.functions";
import { listAccounts } from "@/lib/accounts.functions";

export type EditableOrder = {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string | null;
  table_number: string | null;
  jury_room: string | null;
  company_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postcode: string | null;
  delivery_notes: string | null;
  payment_method: string | null;
  payment_status: string | null;
  items: { name: string; qty: number; notes: string | null }[];
  total_cents?: number;
};

type Line = { name: string; qty: number; notes: string };

/** Corrects a hand-keyed kitchen ticket — wrong amount, name, room or items. */
export function EditOrderDialog({
  order,
  onClose,
  onSaved,
}: {
  order: EditableOrder | null;
  onClose: () => void;
  onSaved?: (patch: {
    id: string;
    customer_name: string;
    customer_phone: string;
    table_number: string | null;
    jury_room: string | null;
    company_name: string | null;
    address_line1: string | null;
    address_line2: string | null;
    postcode: string | null;
    delivery_notes: string | null;
    payment_method: string;
    payment_status: string;
    items: { name: string; qty: number; notes: string | null }[];
  }) => void;
}) {
  const save = useServerFn(updateManualOrder);
  const loadAccounts = useServerFn(listAccounts);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [table, setTable] = useState("");
  const [room, setRoom] = useState("");
  const [company, setCompany] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes] = useState("");
  const [total, setTotal] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | "account" | "platform">(
    "card",
  );
  const [accountId, setAccountId] = useState("");
  const [paid, setPaid] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!order) return;
    setName(order.customer_name ?? "");
    setPhone(order.customer_phone ?? "");
    setTable(order.table_number ?? "");
    setRoom(order.jury_room ?? "");
    setCompany(order.company_name ?? "");
    setAddress1(order.address_line1 ?? "");
    setAddress2(order.address_line2 ?? "");
    setPostcode(order.postcode ?? "");
    setNotes(order.delivery_notes ?? "");
    setTotal(order.total_cents != null ? (order.total_cents / 100).toFixed(2) : "");
    const method = (order.payment_method ?? "card") as typeof paymentMethod;
    setPaymentMethod(["card", "cash", "account", "platform"].includes(method) ? method : "card");
    setPaid(order.payment_status === "paid");
    setLines(
      order.items.length
        ? order.items.map((i) => ({ name: i.name, qty: i.qty, notes: i.notes ?? "" }))
        : [{ name: "", qty: 1, notes: "" }],
    );
  }, [order]);

  useEffect(() => {
    if (paymentMethod !== "account" || accounts.length) return;
    void loadAccounts()
      .then((rows) =>
        setAccounts(
          rows
            .filter((r) => r.active)
            .map((r) => ({ id: r.id, name: r.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      )
      .catch(() => setAccounts([]));
  }, [paymentMethod]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) return null;

  const field =
    "mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground";

  function update(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!order) return;
    const items = lines
      .filter((l) => l.name.trim())
      .map((l) => ({
        name: l.name.trim(),
        qty: Math.max(1, Number(l.qty) || 1),
        notes: l.notes.trim() || undefined,
      }));
    if (!items.length) return toast.error("Add at least one item");
    setSaving(true);
    try {
      await save({
        data: {
          order_id: order.id,
          customer_name: name.trim() || undefined,
          customer_phone: phone.trim() || undefined,
          total_cents: Math.round((Number(total) || 0) * 100),
          payment_method: paymentMethod,
          account_id: paymentMethod === "account" && accountId ? accountId : null,
          paid: paymentMethod === "account" ? false : paid,
          notes: notes.trim() || undefined,
          table_number: table.trim() || undefined,
          jury_room: room.trim() || undefined,
          company_name: company.trim() || undefined,
          address_line1: address1.trim() || undefined,
          address_line2: address2.trim() || undefined,
          postcode: postcode.trim() || undefined,
          items,
        },
      });
      toast.success(`Order #${order.order_number} updated`);
      onSaved?.({
        id: order.id,
        customer_name: name.trim() || "Counter customer",
        customer_phone: phone.trim(),
        table_number: table.trim() || null,
        jury_room: room.trim() || null,
        company_name: company.trim() || null,
        address_line1: address1.trim() || null,
        address_line2: address2.trim() || null,
        postcode: postcode.trim().toUpperCase() || null,
        delivery_notes: notes.trim() || null,
        payment_method: paymentMethod,
        payment_status:
          paymentMethod === "account" ? "on_account" : paid ? "paid" : "pending",
        items: items.map((i) => ({ name: i.name, qty: i.qty, notes: i.notes ?? null })),
      });
      onClose();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save the changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-background p-5 text-foreground shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold">Edit order #{order.order_number}</h2>
            <p className="text-sm text-muted-foreground">
              Fix wrong details, amount or items — the kitchen card updates straight away.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Customer name
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <label className="text-sm font-medium">
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
          </label>
          <label className="text-sm font-medium">
            Order total (£)
            <input
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className={field}
            />
          </label>
          <label className="text-sm font-medium">
            Table
            <input value={table} onChange={(e) => setTable(e.target.value)} className={field} />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Court location / room
            <input value={room} onChange={(e) => setRoom(e.target.value)} className={field} />
          </label>
          <label className="text-sm font-medium">
            Building / office
            <input value={company} onChange={(e) => setCompany(e.target.value)} className={field} />
          </label>
          <label className="text-sm font-medium">
            Postcode
            <input
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              className={`${field} uppercase`}
            />
          </label>
          <label className="text-sm font-medium">
            Address line 1
            <input value={address1} onChange={(e) => setAddress1(e.target.value)} className={field} />
          </label>
          <label className="text-sm font-medium">
            Address line 2
            <input value={address2} onChange={(e) => setAddress2(e.target.value)} className={field} />
          </label>

          <label className="text-sm font-medium">
            Payment
            <select
              value={paymentMethod}
              onChange={(e) => {
                const method = e.target.value as typeof paymentMethod;
                setPaymentMethod(method);
                if (method === "account") setPaid(false);
              }}
              className={field}
            >
              <option value="platform">Paid on the platform</option>
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="account">House account / tab</option>
            </select>
          </label>
          {paymentMethod === "account" && (
            <label className="text-sm font-medium">
              Tab account
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className={field}
              >
                <option value="">Select an account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="mt-1 flex items-center gap-2 self-end text-sm font-medium">
            <input
              type="checkbox"
              checked={paymentMethod === "account" ? false : paid}
              disabled={paymentMethod === "account"}
              onChange={(e) => setPaid(e.target.checked)}
              className="h-4 w-4"
            />
            Already paid
          </label>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">Items</p>
          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="flex items-start gap-2">
                <input
                  value={line.qty}
                  onChange={(e) => update(index, { qty: Number(e.target.value) })}
                  type="number"
                  min={1}
                  max={50}
                  aria-label="Quantity"
                  className="h-11 w-16 rounded-xl border border-border bg-background px-2 text-center"
                />
                <div className="flex-1 space-y-2">
                  <input
                    value={line.name}
                    onChange={(e) => update(index, { name: e.target.value })}
                    placeholder="Item name"
                    aria-label="Item name"
                    className="h-11 w-full rounded-xl border border-border bg-background px-3"
                  />
                  <input
                    value={line.notes}
                    onChange={(e) => update(index, { notes: e.target.value })}
                    placeholder="Modifiers or notes (optional)"
                    aria-label="Item notes"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setLines((c) => c.filter((_, i) => i !== index))}
                  disabled={lines.length === 1}
                  aria-label="Remove item"
                  className="mt-0.5 rounded-xl p-2.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLines((c) => [...c, { name: "", qty: 1, notes: "" }])}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Add item
          </button>
        </div>

        <label className="mt-4 block text-sm font-medium">
          Kitchen note
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
