/**
 * Builds SumUp POS catalogue import files from the Cafe1 menu.
 *
 * SumUp has no public write API for the POS catalogue, so the menu is exported
 * as CSV and uploaded once in the SumUp dashboard (Items -> Import).
 */

export type ExportCategory = { id: string; name: string; sort_order: number; active: boolean };
export type ExportItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  barcode: string | null;
  active: boolean;
  sort_order: number;
};
export type ExportModifier = {
  id: string;
  category_id: string | null;
  item_id: string | null;
  name: string;
  price_cents: number;
  active: boolean;
  sort_order: number;
  group_name: string | null;
  group_type: string;
  required: boolean;
  min_selections: number;
  max_selections: number | null;
};

/** Order-level service choice SumUp should ask once per sale. */
export const SERVICE_TYPE_GROUP = "Service type";
export const SERVICE_TYPE_OPTIONS = ["Dine in", "Takeaway"] as const;

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

function price(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Items file: one row per active item, in SumUp's item import shape. */
export function buildSumUpItemsCsv(categories: ExportCategory[], items: ExportItem[]): string {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const rows: (string | number | null)[][] = [
    ["Item name", "Description", "Category", "Price", "Tax rate", "Barcode", "SKU"],
  ];
  const sorted = items
    .filter((i) => i.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  for (const item of sorted) {
    rows.push([
      item.name,
      item.description ?? "",
      (item.category_id && catName.get(item.category_id)) || "Uncategorised",
      price(item.price_cents),
      "0",
      item.barcode ?? "",
      item.id.slice(0, 8).toUpperCase(),
    ]);
  }
  return toCsv(rows);
}

/**
 * Modifiers file: one row per option, grouped so SumUp can rebuild the option
 * sets. The order-level Dine in / Takeaway choice is prepended as a required
 * group that applies to every category.
 */
export function buildSumUpModifiersCsv(
  categories: ExportCategory[],
  items: ExportItem[],
  modifiers: ExportModifier[],
): string {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const itemName = new Map(items.map((i) => [i.id, i.name]));
  const rows: (string | number | null)[][] = [
    [
      "Option group",
      "Option name",
      "Price",
      "Required",
      "Min selections",
      "Max selections",
      "Applies to category",
      "Applies to item",
    ],
  ];
  for (const option of SERVICE_TYPE_OPTIONS) {
    rows.push([SERVICE_TYPE_GROUP, option, "0.00", "Yes", 1, 1, "All", ""]);
  }
  const sorted = modifiers
    .filter((m) => m.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  for (const modifier of sorted) {
    const min = Math.max(modifier.required ? 1 : 0, modifier.min_selections ?? 0);
    const max =
      modifier.max_selections ?? (modifier.group_type === "single" ? 1 : "");
    rows.push([
      modifier.group_name?.trim() || "Extras",
      modifier.name,
      price(modifier.price_cents),
      min > 0 ? "Yes" : "No",
      min,
      max,
      (modifier.category_id && catName.get(modifier.category_id)) || "",
      (modifier.item_id && itemName.get(modifier.item_id)) || "",
    ]);
  }
  return toCsv(rows);
}

/** Categories file, kept separate so SumUp category order matches the app. */
export function buildSumUpCategoriesCsv(categories: ExportCategory[]): string {
  const rows: (string | number | null)[][] = [["Category name", "Sort order"]];
  for (const category of categories
    .filter((c) => c.active)
    .sort((a, b) => a.sort_order - b.sort_order)) {
    rows.push([category.name, category.sort_order]);
  }
  return toCsv(rows);
}