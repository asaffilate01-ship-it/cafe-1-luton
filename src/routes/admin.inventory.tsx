import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { RequireRole } from "@/components/require-role";
import { SiteSwitcher } from "@/components/site-switcher";
import { useSites } from "@/hooks/use-sites";
import {
  completeStocktake,
  deleteRecipeComponent,
  getInventoryDashboard,
  recordStockMovement,
  saveInventoryItem,
  saveRecipeComponent,
  startStocktake,
  type InventoryDashboard,
  type InventoryItem,
} from "@/lib/inventory.functions";
import { money } from "@/lib/format";
import { toast } from "sonner";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Scale,
  Trash2,
  Utensils,
} from "lucide-react";

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({
    meta: [{ title: "Inventory & recipes — Cafe 1" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireRole roles={["admin", "staff"]} next="/admin/inventory">
      <InventoryPage />
    </RequireRole>
  ),
});

type StockForm = {
  id?: string;
  sku: string;
  barcode: string;
  name: string;
  unit: InventoryItem["unit"];
  quantity_on_hand: string;
  reorder_level: string;
  par_level: string;
  cost: string;
  allergens: string;
  active: boolean;
};
const EMPTY: StockForm = {
  sku: "",
  barcode: "",
  name: "",
  unit: "each",
  quantity_on_hand: "0",
  reorder_level: "0",
  par_level: "0",
  cost: "0.00",
  allergens: "",
  active: true,
};

function InventoryPage() {
  const sites = useSites();
  const get = useServerFn(getInventoryDashboard);
  const save = useServerFn(saveInventoryItem);
  const move = useServerFn(recordStockMovement);
  const saveRecipe = useServerFn(saveRecipeComponent);
  const removeRecipe = useServerFn(deleteRecipeComponent);
  const beginCount = useServerFn(startStocktake);
  const finishCount = useServerFn(completeStocktake);
  const [data, setData] = useState<InventoryDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stock" | "recipes" | "stocktake">("stock");
  const [form, setForm] = useState<StockForm>(EMPTY);
  const [movementFor, setMovementFor] = useState<InventoryItem | null>(null);
  const [movement, setMovement] = useState({ movement_type: "waste", quantity: "", reason: "" });
  const [recipeItemId, setRecipeItemId] = useState("");
  const [recipeInput, setRecipeInput] = useState({
    inventory_item_id: "",
    quantity: "",
    wastage_percent: "0",
  });
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dashboard = await get({ data: { site_id: sites.siteId } });
      setData(dashboard);
      setRecipeItemId((current) => current || dashboard.menu_items[0]?.id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load inventory");
    } finally {
      setLoading(false);
    }
  }, [get, sites.siteId]);
  useEffect(() => {
    void load();
  }, [load]);

  const selectedRecipe = data?.menu_items.find((item) => item.id === recipeItemId) ?? null;
  const low = data?.items.filter((item) => item.low_stock) ?? [];
  const value = data?.items.reduce((sum, item) => sum + Number(item.stock_value_cents), 0) ?? 0;

  function edit(item?: InventoryItem) {
    setForm(
      item
        ? {
            id: item.id,
            sku: item.sku,
            barcode: item.barcode ?? "",
            name: item.name,
            unit: item.unit,
            quantity_on_hand: String(item.quantity_on_hand),
            reorder_level: String(item.reorder_level),
            par_level: String(item.par_level),
            cost: (Number(item.cost_per_unit_cents) / 100).toFixed(4),
            allergens: item.allergens.join(", "),
            active: item.active,
          }
        : EMPTY,
    );
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
          site_id: sites.siteId,
          id: form.id,
          sku: form.sku,
          barcode: form.barcode || undefined,
          name: form.name,
          unit: form.unit,
          quantity_on_hand: Number(form.quantity_on_hand),
          reorder_level: Number(form.reorder_level),
          par_level: Number(form.par_level),
          cost_per_unit_cents: Number(form.cost) * 100,
          allergens: form.allergens
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          active: form.active,
        },
      });
      toast.success(form.id ? "Stock item updated" : "Stock item created");
      edit();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save item");
    } finally {
      setBusy(false);
    }
  }

  async function recordMovement(event: React.FormEvent) {
    event.preventDefault();
    if (!movementFor) return;
    setBusy(true);
    try {
      await move({
        data: {
          inventory_item_id: movementFor.id,
          movement_type: movement.movement_type as
            "purchase" | "waste" | "transfer_in" | "transfer_out" | "correction" | "staff_meal",
          quantity_delta: Number(movement.quantity),
          reason: movement.reason,
        },
      });
      toast.success("Stock movement recorded");
      setMovementFor(null);
      setMovement({ movement_type: "waste", quantity: "", reason: "" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record movement");
    } finally {
      setBusy(false);
    }
  }

  async function addRecipe(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedRecipe) return;
    setBusy(true);
    try {
      await saveRecipe({
        data: {
          menu_item_id: selectedRecipe.id,
          inventory_item_id: recipeInput.inventory_item_id,
          quantity: Number(recipeInput.quantity),
          wastage_percent: Number(recipeInput.wastage_percent),
        },
      });
      toast.success("Recipe and food cost updated");
      setRecipeInput({ inventory_item_id: "", quantity: "", wastage_percent: "0" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update recipe");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">
              Food cost &amp; controls
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold">Inventory and recipes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Theoretical usage, actual counts, waste and standard portions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SiteSwitcher
              compact
              sites={sites.sites}
              siteId={sites.siteId}
              onChange={sites.setSiteId}
              loading={sites.loading}
              error={sites.error}
            />
            <button
              onClick={() => void load()}
              aria-label="Refresh"
              className="grid h-10 w-10 place-items-center rounded-xl border border-border"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric icon={Boxes} label="Stock items" value={String(data?.items.length ?? 0)} />
          <Metric
            icon={AlertTriangle}
            label="Low stock"
            value={String(low.length)}
            warning={low.length > 0}
          />
          <Metric icon={Scale} label="Stock value" value={money(value)} />
        </section>
        <div className="mt-6 flex gap-2 overflow-x-auto">
          {(
            [
              ["stock", "Stock"],
              ["recipes", "Recipes & portions"],
              ["stocktake", "Stocktake"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === id ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : tab === "stock" ? (
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_380px]">
            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <h2 className="font-display text-xl font-bold">Stock ledger</h2>
                  <p className="text-sm text-muted-foreground">
                    Select an item to record delivery, waste, transfer or correction.
                  </p>
                </div>
                <button
                  onClick={() => edit()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
                >
                  <Plus className="h-4 w-4" /> New
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="p-3">Item</th>
                      <th className="p-3">On hand</th>
                      <th className="p-3">Reorder</th>
                      <th className="p-3">Value</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.items.map((item) => (
                      <tr key={item.id} className={item.low_stock ? "bg-amber-50/70" : ""}>
                        <td className="p-3">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.sku}
                            {item.allergens.length ? ` · ${item.allergens.join(", ")}` : ""}
                          </p>
                        </td>
                        <td className="p-3 font-bold tabular-nums">
                          {item.quantity_on_hand} {item.unit}
                        </td>
                        <td className="p-3 tabular-nums">{item.reorder_level}</td>
                        <td className="p-3 tabular-nums">
                          {money(Number(item.stock_value_cents))}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setMovementFor(item)}
                              className="rounded-lg border border-border px-2.5 py-1.5 font-semibold"
                            >
                              Movement
                            </button>
                            <button
                              onClick={() => edit(item)}
                              className="rounded-lg border border-border px-2.5 py-1.5"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!data?.items.length && (
                      <tr>
                        <td colSpan={5} className="p-10 text-center text-muted-foreground">
                          Add your first ingredient or packaged stock item.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            <StockItemForm form={form} setForm={setForm} onSubmit={saveItem} busy={busy} />
          </div>
        ) : tab === "recipes" ? (
          <div className="mt-5 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-border bg-card p-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Menu item
              </label>
              <select
                value={recipeItemId}
                onChange={(event) => setRecipeItemId(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3"
              >
                {data?.menu_items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {selectedRecipe && (
                <div className="mt-4 rounded-xl bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Selling price</p>
                  <p className="font-display text-xl font-bold">
                    {money(selectedRecipe.price_cents)}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">Recipe cost</p>
                  <p className="font-display text-xl font-bold">
                    {money(selectedRecipe.cost_cents)}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">Gross margin</p>
                  <p className="font-display text-xl font-bold">
                    {selectedRecipe.price_cents
                      ? Math.round(
                          ((selectedRecipe.price_cents - selectedRecipe.cost_cents) /
                            selectedRecipe.price_cents) *
                            100,
                        )
                      : 0}
                    %
                  </p>
                </div>
              )}
            </section>
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl font-bold">Standard recipe and portion</h2>
              </div>
              <div className="mt-4 space-y-2">
                {selectedRecipe?.recipe.map((component) => {
                  const inv = data?.items.find((item) => item.id === component.inventory_item_id);
                  return (
                    <div
                      key={component.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                    >
                      <div>
                        <p className="font-semibold">{inv?.name ?? "Stock item"}</p>
                        <p className="text-sm text-muted-foreground">
                          {component.quantity} {inv?.unit} · {component.wastage_percent}% allowance
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await removeRecipe({ data: { component_id: component.id } });
                          await load();
                        }}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-border text-destructive"
                        aria-label="Remove recipe component"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
                {!selectedRecipe?.recipe.length && (
                  <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                    No recipe components yet.
                  </p>
                )}
              </div>
              <form
                onSubmit={addRecipe}
                className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-[minmax(0,1fr)_120px_120px_auto]"
              >
                <select
                  required
                  value={recipeInput.inventory_item_id}
                  onChange={(event) =>
                    setRecipeInput({ ...recipeInput, inventory_item_id: event.target.value })
                  }
                  className="h-11 rounded-xl border border-border bg-background px-3"
                >
                  <option value="">Ingredient…</option>
                  {data?.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.unit})
                    </option>
                  ))}
                </select>
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={recipeInput.quantity}
                  onChange={(event) =>
                    setRecipeInput({ ...recipeInput, quantity: event.target.value })
                  }
                  placeholder="Quantity"
                  className="h-11 rounded-xl border border-border bg-background px-3"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={recipeInput.wastage_percent}
                  onChange={(event) =>
                    setRecipeInput({ ...recipeInput, wastage_percent: event.target.value })
                  }
                  aria-label="Wastage percent"
                  className="h-11 rounded-xl border border-border bg-background px-3"
                />
                <button
                  disabled={busy}
                  className="h-11 rounded-xl bg-primary px-4 font-bold text-primary-foreground"
                >
                  Add
                </button>
              </form>
            </section>
          </div>
        ) : (
          <StocktakePanel
            data={data}
            siteId={sites.siteId}
            counts={counts}
            setCounts={setCounts}
            begin={beginCount}
            finish={finishCount}
            reload={load}
            busy={busy}
            setBusy={setBusy}
          />
        )}
      </main>

      {movementFor && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Record stock movement"
        >
          <form
            onSubmit={recordMovement}
            className="w-full max-w-md rounded-2xl bg-card p-5 shadow-2xl"
          >
            <h2 className="font-display text-xl font-bold">{movementFor.name}</h2>
            <p className="text-sm text-muted-foreground">
              Current stock: {movementFor.quantity_on_hand} {movementFor.unit}
            </p>
            <div className="mt-4 grid gap-3">
              <select
                value={movement.movement_type}
                onChange={(event) =>
                  setMovement({ ...movement, movement_type: event.target.value })
                }
                className="h-11 rounded-xl border border-border bg-background px-3"
              >
                <option value="purchase">Delivery / purchase</option>
                <option value="waste">Waste / spoilage</option>
                <option value="staff_meal">Staff meal</option>
                <option value="transfer_in">Transfer in</option>
                <option value="transfer_out">Transfer out</option>
                <option value="correction">Correction (+ or -)</option>
              </select>
              <input
                required
                type="number"
                step="0.001"
                value={movement.quantity}
                onChange={(event) => setMovement({ ...movement, quantity: event.target.value })}
                placeholder={`Quantity (${movementFor.unit})`}
                className="h-11 rounded-xl border border-border bg-background px-3"
              />
              <textarea
                required
                minLength={3}
                value={movement.reason}
                onChange={(event) => setMovement({ ...movement, reason: event.target.value })}
                placeholder="Reason for the audit trail"
                className="min-h-24 rounded-xl border border-border bg-background p-3"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                disabled={busy}
                className="h-11 flex-1 rounded-xl bg-primary font-bold text-primary-foreground"
              >
                Record
              </button>
              <button
                type="button"
                onClick={() => setMovementFor(null)}
                className="h-11 rounded-xl border border-border px-4"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  warning = false,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 ${warning ? "border-amber-300 bg-amber-50" : "border-border bg-card"}`}
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
function StockItemForm({
  form,
  setForm,
  onSubmit,
  busy,
}: {
  form: StockForm;
  setForm: (form: StockForm) => void;
  onSubmit: (event: React.FormEvent) => void;
  busy: boolean;
}) {
  const inputClass =
    "mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-primary";
  return (
    <form onSubmit={onSubmit} className="h-fit rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl font-bold">
        {form.id ? "Edit stock item" : "New stock item"}
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="SKU">
          <input
            required
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Barcode">
          <input
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Unit">
          <select
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value as StockForm["unit"] })}
            className={inputClass}
          >
            {["each", "g", "kg", "ml", "l", "portion", "pack"].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Field>
        {!form.id && (
          <Field label="Opening quantity">
            <input
              type="number"
              step="0.001"
              value={form.quantity_on_hand}
              onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })}
              className={inputClass}
            />
          </Field>
        )}
        <Field label="Reorder at">
          <input
            type="number"
            step="0.001"
            value={form.reorder_level}
            onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Par level">
          <input
            type="number"
            step="0.001"
            value={form.par_level}
            onChange={(e) => setForm({ ...form, par_level: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Cost per unit £">
          <input
            type="number"
            min="0"
            step="0.0001"
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Allergens (comma separated)" wide>
          <input
            value={form.allergens}
            onChange={(e) => setForm({ ...form, allergens: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />{" "}
        Active
      </label>
      <button
        disabled={busy}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50"
      >
        <Save className="h-4 w-4" /> Save stock item
      </button>
    </form>
  );
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
type StartCount = (options: { data: { site_id: string; title: string } }) => Promise<unknown>;
type FinishCount = (options: {
  data: {
    stocktake_id: string;
    counts: Array<{ inventory_item_id: string; counted_quantity: number }>;
  };
}) => Promise<unknown>;
function StocktakePanel({
  data,
  siteId,
  counts,
  setCounts,
  begin,
  finish,
  reload,
  busy,
  setBusy,
}: {
  data: InventoryDashboard | null;
  siteId: string;
  counts: Record<string, string>;
  setCounts: (counts: Record<string, string>) => void;
  begin: StartCount;
  finish: FinishCount;
  reload: () => Promise<void>;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const stocktake = data?.open_stocktakes[0];
  return (
    <section className="mt-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">
              {stocktake?.title ?? "Start a controlled stocktake"}
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Counts post auditable variance movements and update the live stock ledger.
          </p>
        </div>
        {!stocktake && (
          <button
            onClick={async () => {
              const title = window.prompt(
                "Stocktake title:",
                `Month-end stocktake ${new Date().toLocaleDateString()}`,
              );
              if (!title) return;
              setBusy(true);
              try {
                await begin({ data: { site_id: siteId, title } });
                toast.success("Stocktake opened");
                await reload();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not start stocktake");
              } finally {
                setBusy(false);
              }
            }}
            className="h-11 rounded-xl bg-primary px-4 font-bold text-primary-foreground"
          >
            Start stocktake
          </button>
        )}
      </div>
      {stocktake && (
        <>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">Item</th>
                  <th className="p-3">Expected</th>
                  <th className="p-3">Counted</th>
                  <th className="p-3">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stocktake.lines.map((line) => {
                  const value = counts[line.inventory_item_id] ?? "";
                  const variance =
                    value === "" ? null : Number(value) - Number(line.expected_quantity);
                  return (
                    <tr key={line.inventory_item_id}>
                      <td className="p-3 font-semibold">{line.item_name}</td>
                      <td className="p-3">
                        {line.expected_quantity} {line.unit}
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={value}
                          onChange={(e) =>
                            setCounts({ ...counts, [line.inventory_item_id]: e.target.value })
                          }
                          className="h-10 w-32 rounded-xl border border-border bg-background px-3"
                        />
                      </td>
                      <td
                        className={`p-3 font-bold ${variance && variance !== 0 ? "text-amber-700" : ""}`}
                      >
                        {variance === null ? "—" : variance.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            disabled={busy || stocktake.lines.some((line) => !counts[line.inventory_item_id])}
            onClick={async () => {
              setBusy(true);
              try {
                await finish({
                  data: {
                    stocktake_id: stocktake.id,
                    counts: stocktake.lines.map((line) => ({
                      inventory_item_id: line.inventory_item_id,
                      counted_quantity: Number(counts[line.inventory_item_id]),
                    })),
                  },
                });
                toast.success("Stocktake completed and variance posted");
                setCounts({});
                await reload();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not complete stocktake");
              } finally {
                setBusy(false);
              }
            }}
            className="mt-5 h-11 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-40"
          >
            Complete and post variance
          </button>
        </>
      )}
    </section>
  );
}
