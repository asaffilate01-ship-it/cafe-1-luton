import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { createManualDeliverooTicket } from "@/lib/deliveroo-manual.functions";

type Line = { name: string; qty: number; notes: string };

const emptyLine = (): Line => ({ name: "", qty: 1, notes: "" });

/**
 * Lets counter staff push a Deliveroo tablet order straight onto the KDS.
 * Used until Cafe1 is live through a certified Deliveroo POS integration.
 */
export function DeliverooTicketDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const create = useServerFn(createManualDeliverooTicket);
  const [reference, setReference] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [type, setType] = useState<"delivery" | "collection">("delivery");
  const [total, setTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function update(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function reset() {
    setReference("");
    setCustomerName("");
    setType("delivery");
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
    if (!reference.trim()) return toast.error("Enter the Deliveroo order reference");
    if (!items.length) return toast.error("Add at least one item");

    setSaving(true);
    try {
      const result = await create({
        data: {
          reference: reference.trim(),
          customer_name: customerName.trim() || undefined,
          type,
          total_cents: Math.round((Number(total) || 0) * 100),
          notes: notes.trim() || undefined,
          items,
        },
      });
      if (result.duplicate) {
        toast.info(`Order ${reference.trim().toUpperCase()} is already on the display`);
      } else {
        toast.success(`Deliveroo ${reference.trim().toUpperCase()} sent to the kitchen`);
      }
      reset();
      onCreated?.();
      onClose();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not create the ticket");
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
            <h2 className="font-display text-xl font-bold">Add Deliveroo order</h2>
            <p className="text-sm text-muted-foreground">
              Key in what the Deliveroo tablet shows. It appears on the display as a Deliveroo
              ticket.
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
            Order reference
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="e.g. F3K9"
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 uppercase"
              required
            />
          </label>
          <label className="text-sm font-medium">
            Customer first name
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Optional"
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3"
            />
          </label>
          <label className="text-sm font-medium">
            Fulfilment
            <select
              value={type}
              onChange={(event) => setType(event.target.value as "delivery" | "collection")}
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3"
            >
              <option value="delivery">Rider delivery</option>
              <option value="collection">Customer collection</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Order total (£)
            <input
              value={total}
              onChange={(event) => setTotal(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3"
            />
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
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3"
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
