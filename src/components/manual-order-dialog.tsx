import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { createManualOrder, type ManualChannel } from "@/lib/manual-order.functions";
import { listAccounts, quickAddAccount } from "@/lib/accounts.functions";
import { findSimilarAccountOrder } from "@/lib/judge-tab.functions";
import { askConfirm } from "@/lib/confirm";
import { money } from "@/lib/format";
import { JURY_DELIVERY_ROOMS } from "@/components/order-setup-gate";

type Line = { name: string; qty: number; notes: string };
const emptyLine = (): Line => ({ name: "", qty: 1, notes: "" });

const CHANNELS: { value: ManualChannel; label: string; hint: string }[] = [
  { value: "deliveroo", label: "Deliveroo", hint: "Key in what the Deliveroo tablet shows" },
  { value: "just_eat", label: "Just Eat", hint: "Key in what the Just Eat tablet shows" },
  { value: "uber_eats", label: "Uber Eats", hint: "Key in what the Uber Eats tablet shows" },
  { value: "tgtg", label: "Too Good To Go", hint: "Magic bag collection" },
  { value: "jury", label: "Jury side", hint: "Juror order taken at the counter or by phone" },
  { value: "judge", label: "Judges", hint: "Judge order — usually billed to the tab" },
  { value: "public", label: "Public side", hint: "Walk-in counter order" },
  { value: "web", label: "Website", hint: "Order taken on behalf of a web customer" },
  { value: "phone", label: "Phone order", hint: "Order taken over the phone" },
];

const FULFILMENTS = [
  { value: "collection", label: "Takeaway / collection" },
  { value: "dine_in", label: "Dine in" },
  { value: "dine_in_judges", label: "Dine in — Judges' room" },
  { value: "delivery", label: "Delivery" },
] as const;

/** Where a "Dine in — Judges' room" ticket is served. */
const JUDGES_ROOM = "Judges' Room — St Albans Court";

type Fulfilment = (typeof FULFILMENTS)[number]["value"];

/** Lets counter staff push any order — marketplace, court or phone — onto the KDS. */
export function ManualOrderDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const create = useServerFn(createManualOrder);
  const loadAccounts = useServerFn(listAccounts);
  const addAccount = useServerFn(quickAddAccount);
  const findSimilar = useServerFn(findSimilarAccountOrder);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [accountId, setAccountId] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);
  const [channel, setChannel] = useState<ManualChannel>("deliveroo");
  const [reference, setReference] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [type, setType] = useState<Fulfilment>("collection");
  const [table, setTable] = useState("");
  const [juryRoom, setJuryRoom] = useState<string>(JURY_DELIVERY_ROOMS[0].label);
  const [company, setCompany] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [postcode, setPostcode] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | "account" | "platform">(
    "platform",
  );
  const [paid, setPaid] = useState(true);
  const [total, setTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || paymentMethod !== "account" || accounts.length) return;
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
  }, [open, paymentMethod]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Adds a judge/advocate tab from the counter and selects it straight away. */
  async function createTabAccount() {
    const name = newAccountName.trim();
    if (name.length < 2) return toast.error("Enter the judge or advocate name");
    setAddingAccount(true);
    try {
      const row = await addAccount({ data: { name } });
      setAccounts((current) =>
        (current.some((a) => a.id === row.id) ? current : [...current, { id: row.id, name: row.name }]).sort(
          (a, b) => a.name.localeCompare(b.name),
        ),
      );
      setAccountId(row.id);
      setNewAccountName("");
      toast.success(row.existed ? `${row.name} already had a tab — selected` : `${row.name} tab added`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not add the account");
    } finally {
      setAddingAccount(false);
    }
  }

  if (!open) return null;

  const meta = CHANNELS.find((c) => c.value === channel)!;
  const isMarketplace = ["deliveroo", "just_eat", "uber_eats", "tgtg"].includes(channel);
  const isCourt = channel === "jury" || channel === "judge";

  function update(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function pickChannel(next: ManualChannel) {
    setChannel(next);
    const method =
      next === "judge"
        ? "account"
        : ["deliveroo", "just_eat", "uber_eats", "tgtg"].includes(next)
          ? "platform"
          : "card";
    setPaymentMethod(method);
    // A tab is by definition unpaid until the weekly bill is settled.
    setPaid(method !== "account");
    if (next === "tgtg") setType("collection");
  }

  function reset() {
    setReference("");
    setCustomerName("");
    setTable("");
    setCompany("");
    setAddress1("");
    setAddress2("");
    setPostcode("");
    setPhone("");
    setTotal("");
    setNotes("");
    setLines([emptyLine()]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const items = lines
      .filter((line) => line.name.trim())
      .map((line) => ({
        name: line.name.trim(),
        qty: Math.max(1, Number(line.qty) || 1),
        notes: line.notes.trim() || undefined,
      }));
    if (isMarketplace && !reference.trim()) return toast.error("Enter the order reference");
    if (!items.length) return toast.error("Add at least one item");

    // A judge often re-orders the same lunch — warn before a second unpaid
    // charge lands on the same tab.
    if (paymentMethod === "account" && accountId) {
      try {
        const { match } = await findSimilar({
          data: {
            account_id: accountId,
            item_names: items.flatMap((line) => Array(line.qty).fill(line.name) as string[]),
          },
        });
        if (match) {
          const when = new Date(match.created_at).toLocaleString([], {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          const ok = await askConfirm({
            title: `Possible duplicate for ${match.account_name}`,
            description: `${match.account_name} had a ${match.identical ? "matching" : "similar"} order on ${when} (#${match.order_number}, ${money(match.total_cents)}) which is still unpaid. Is this a different order?`,
            confirmLabel: "Yes — different order",
            cancelLabel: "No — cancel",
            destructive: false,
          });
          if (!ok) return;
        }
      } catch {
        // A failed duplicate check must never block a real order.
      }
    }

    setSaving(true);
    try {
      const result = await create({
        data: {
          channel,
          reference: reference.trim() || undefined,
          customer_name:
            customerName.trim() ||
            (paymentMethod === "account"
              ? accounts.find((a) => a.id === accountId)?.name
              : undefined) ||
            undefined,
          // "Judges' room" is a dine-in ticket served to a specific room.
          type: type === "dine_in_judges" ? "dine_in" : type,
          total_cents: Math.round((Number(total) || 0) * 100),
          payment_method: paymentMethod,
          account_id: paymentMethod === "account" && accountId ? accountId : undefined,
          paid,
          notes: notes.trim() || undefined,
          table_number: table.trim() || undefined,
          jury_room:
            type === "dine_in_judges"
              ? JUDGES_ROOM
              : isCourt && type !== "collection"
                ? juryRoom
                : undefined,
          company_name: company.trim() || undefined,
          address_line1: address1.trim() || undefined,
          address_line2: address2.trim() || undefined,
          postcode: postcode.trim() || undefined,
          customer_phone: phone.trim() || undefined,
          items,
        },
      });
      if (result.duplicate) {
        // Keep the form open so staff can change the reference and send it —
        // closing here made a real second order look like it had been sent.
        toast.error(
          `${meta.label} ${reference.trim().toUpperCase()} is already on the display${
            result.order_number ? ` as #${result.order_number}` : ""
          }. Change the reference to send a separate ticket.`,
        );
        onCreated?.();
        return;
      }
      toast.success(`${meta.label} order sent to the kitchen`);
      reset();
      onCreated?.();
      onClose();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not create the ticket");
    } finally {
      setSaving(false);
    }
  }

  const field =
    "mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-order-title"
      aria-describedby="manual-order-hint"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-background p-5 text-foreground shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="manual-order-title" className="font-display text-xl font-bold">
              Add order
            </h2>
            <p id="manual-order-hint" className="text-sm text-muted-foreground">
              {meta.hint}. It lands on the display in the right channel colour.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-2 text-sm font-semibold">Where is it from?</p>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={channel === c.value}
              onClick={() => pickChannel(c.value)}
              className={`min-h-11 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                channel === c.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Order reference {isMarketplace ? "" : "(optional)"}
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="e.g. F3K9"
              className={`${field} uppercase`}
            />
          </label>
          <label className="text-sm font-medium">
            Customer name
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Optional"
              className={field}
            />
          </label>
          <label className="text-sm font-medium">
            Fulfilment
            <select
              value={type}
              onChange={(event) => setType(event.target.value as typeof type)}
              className={field}
            >
              {FULFILMENTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Order total (£)
            <input
              value={total}
              onChange={(event) => setTotal(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className={field}
            />
          </label>

          {(type === "dine_in" || type === "dine_in_judges") && (
            <label className="text-sm font-medium">
              Table
              <input value={table} onChange={(e) => setTable(e.target.value)} className={field} />
            </label>
          )}

          {type === "dine_in_judges" && (
            <p className="text-sm font-medium text-muted-foreground sm:col-span-2">
              Serving to the <strong>Judges&rsquo; room</strong> — this shows on the kitchen
              display so the runner knows where to take it.
            </p>
          )}

          {isCourt && type !== "collection" && type !== "dine_in_judges" && (
            <label className="text-sm font-medium sm:col-span-2">
              Court location
              <select
                value={juryRoom}
                onChange={(event) => setJuryRoom(event.target.value)}
                className={field}
              >
                {JURY_DELIVERY_ROOMS.map((room) => (
                  <option key={room.id} value={room.label}>
                    {room.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {type === "delivery" && !isCourt && (
            <>
              <label className="text-sm font-medium">
                Building / office
                <input value={company} onChange={(e) => setCompany(e.target.value)} className={field} />
              </label>
              <label className="text-sm font-medium">
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
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
                Postcode
                <input
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  className={`${field} uppercase`}
                />
              </label>
            </>
          )}

          <label className="text-sm font-medium">
            Payment
            <select
              value={paymentMethod}
              onChange={(event) => {
                const method = event.target.value as typeof paymentMethod;
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
            <div className="text-sm font-medium sm:col-span-2">
              <label>
                Which tab account?
                <select
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
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
              <div className="mt-2 flex items-end gap-2">
                <label className="flex-1 text-xs font-medium text-muted-foreground">
                  New judge / advocate name
                  <input
                    value={newAccountName}
                    onChange={(event) => setNewAccountName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void createTabAccount();
                      }
                    }}
                    placeholder="e.g. HHJ Grey or Ms A Advocate"
                    className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void createTabAccount()}
                  disabled={addingAccount}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {addingAccount ? "Adding…" : "Add"}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Saved to the tab list so you can pick it next time and filter it on the accounts page.
              </p>
            </div>
          )}
          <label className="mt-1 flex items-center gap-2 self-end text-sm font-medium">
            <input
              type="checkbox"
              checked={paid}
              onChange={(event) => setPaid(event.target.checked)}
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
                  onChange={(event) => update(index, { qty: Number(event.target.value) })}
                  type="number"
                  min={1}
                  max={50}
                  aria-label="Quantity"
                  className="h-11 w-16 rounded-xl border border-border bg-background px-2 text-center"
                />
                <div className="flex-1 space-y-2">
                  <input
                    value={line.name}
                    onChange={(event) => update(index, { name: event.target.value })}
                    placeholder="Item name"
                    aria-label="Item name"
                    className="h-11 w-full rounded-xl border border-border bg-background px-3"
                  />
                  <input
                    value={line.notes}
                    onChange={(event) => update(index, { notes: event.target.value })}
                    placeholder="Modifiers or notes (optional)"
                    aria-label="Item notes"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
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
            onClick={() => setLines((current) => [...current, emptyLine()])}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Add item
          </button>
        </div>

        <label className="mt-4 block text-sm font-medium">
          Kitchen note
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Allergies, cutlery, rider instructions…"
            className={field}
          />
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
            {saving ? "Sending…" : "Send to kitchen"}
          </button>
        </div>
      </form>
    </div>
  );
}
