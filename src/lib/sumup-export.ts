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
/**
 * SumUp's own "items-export" column order. The dashboard importer only accepts
 * a file with this exact header, so it is reproduced verbatim.
 */
export const SUMUP_ITEMS_HEADER = [
  "Item name",
  "Variations",
  "Option set 1",
  "Option 1",
  "Option set 2",
  "Option 2",
  "Option set 3",
  "Option 3",
  "Option set 4",
  "Option 4",
  "Is variation visible? (Yes/No)",
  "Price",
  "Cost price",
  "Variable price? (Yes/No)",
  "Tax rate (%)",
  "On sale in Online Store?",
  "Regular price (before sale)",
  "Set up different prices and VAT for takeaway",
  "Takeaway price",
  "Takeaway tax rate",
  "Unit",
  "Track inventory? (Yes/No)",
  "Quantity",
  "Low stock threshold",
  "SKU",
  "Barcode",
  "Modifiers",
  "Description (Online Store and Invoices only)",
  "Category",
  "Display item at Checkout? (Yes/No)",
  "Display colour in POS checkout",
  "Image 1",
  "Image 2",
  "Image 3",
  "Image 4",
  "Image 5",
  "Image 6",
  "Image 7",
  "Display item in Online Store? (Yes/No)",
  "SEO title (Online Store only)",
  "SEO description (Online Store only)",
  "Shipping weight [kg] (Online Store only)",
  "Display service in Bookings? (Yes/No)",
  "Duration [minutes] (Bookings only)",
  "Location [business/customer] (Bookings only)",
  "Item id (Do not change)",
  "Variant id (Do not change)",
] as const;

/**
 * Full catalogue in SumUp's native items-export layout: one row per item,
 * modifier groups joined in the Modifiers column, plus a variation row per
 * option of the item's first required single-choice group.
 */
export function buildSumUpNativeItemsCsv(
  categories: ExportCategory[],
  items: ExportItem[],
  modifiers: ExportModifier[],
): string {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const active = modifiers.filter((m) => m.active);

  const rows: (string | number | null)[][] = [[...SUMUP_ITEMS_HEADER]];

  const sortedItems = items
    .filter((i) => i.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  for (const item of sortedItems) {
    const applicable = active
      .filter((m) => m.item_id === item.id || (!m.item_id && m.category_id === item.category_id))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

    // Group options by their option-set name.
    const groups = new Map<string, ExportModifier[]>();
    for (const modifier of applicable) {
      const group = modifier.group_name?.trim() || "Extras";
      const list = groups.get(group);
      if (list) list.push(modifier);
      else groups.set(group, [modifier]);
    }

    // The first required single-choice group becomes SumUp variations so the
    // till forces the choice; everything else stays a modifier set.
    let variationGroup: string | null = null;
    for (const [group, options] of groups) {
      const required = options.some((o) => o.required || o.min_selections > 0);
      const single = options.every((o) => o.group_type === "single" || o.max_selections === 1);
      if (required && single && options.length > 1) {
        variationGroup = group;
        break;
      }
    }

    const modifierNames = [SERVICE_TYPE_GROUP, ...[...groups.keys()].filter((g) => g !== variationGroup)];
    const category = (item.category_id && catName.get(item.category_id)) || "Uncategorised";
    const sku = item.id.slice(0, 8).toUpperCase();

    const base = (
      variationName: string,
      optionSet: string,
      option: string,
      priceCents: number,
      variantSku: string,
    ): (string | number | null)[] => {
      const row: (string | number | null)[] = new Array(SUMUP_ITEMS_HEADER.length).fill("");
      row[0] = item.name;
      row[1] = variationName;
      row[2] = optionSet;
      row[3] = option;
      row[10] = variationName ? "Yes" : "";
      row[11] = price(priceCents);
      row[13] = "No";
      row[14] = "0";
      row[21] = "No";
      row[24] = variantSku;
      row[25] = item.barcode ?? "";
      row[26] = modifierNames.join(";");
      row[27] = item.description ?? "";
      row[28] = category;
      row[29] = "Yes";
      row[38] = "Yes";
      return row;
    };

    if (variationGroup) {
      const options = groups.get(variationGroup) ?? [];
      options.forEach((option, index) => {
        rows.push(
          base(
            option.name,
            variationGroup as string,
            option.name,
            item.price_cents + option.price_cents,
            `${sku}-${index + 1}`,
          ),
        );
      });
    } else {
      rows.push(base("", "", "", item.price_cents, sku));
    }
  }

  return toCsv(rows);
}

export function buildSumUpCategoriesCsv(categories: ExportCategory[]): string {
  const rows: (string | number | null)[][] = [["Category name", "Sort order"]];
  for (const category of categories
    .filter((c) => c.active)
    .sort((a, b) => a.sort_order - b.sort_order)) {
    rows.push([category.name, category.sort_order]);
  }
  return toCsv(rows);
}

/**
 * One combined workbook-style CSV holding every category, item and modifier
 * with prices — browsers block several downloads fired back to back, so this
 * single file is what the Export button hands over.
 */
export function buildSumUpFullMenuCsv(
  categories: ExportCategory[],
  items: ExportItem[],
  modifiers: ExportModifier[],
): string {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const itemName = new Map(items.map((i) => [i.id, i.name]));
  const rows: (string | number | null)[][] = [
    [
      "Type",
      "Category",
      "Item",
      "Option group",
      "Name",
      "Description",
      "Price",
      "Tax rate",
      "Required",
      "Min selections",
      "Max selections",
      "Barcode",
      "SKU",
      "Sort order",
    ],
  ];

  for (const category of categories
    .filter((c) => c.active)
    .sort((a, b) => a.sort_order - b.sort_order)) {
    rows.push([
      "Category",
      category.name,
      "",
      "",
      category.name,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      category.sort_order,
    ]);
  }

  for (const item of items
    .filter((i) => i.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))) {
    const category = (item.category_id && catName.get(item.category_id)) || "Uncategorised";
    rows.push([
      "Item",
      category,
      item.name,
      "",
      item.name,
      item.description ?? "",
      price(item.price_cents),
      "0",
      "",
      "",
      "",
      item.barcode ?? "",
      item.id.slice(0, 8).toUpperCase(),
      item.sort_order,
    ]);
  }

  for (const option of SERVICE_TYPE_OPTIONS) {
    rows.push([
      "Modifier",
      "All",
      "",
      SERVICE_TYPE_GROUP,
      option,
      "",
      "0.00",
      "0",
      "Yes",
      1,
      1,
      "",
      "",
      0,
    ]);
  }

  for (const modifier of modifiers
    .filter((m) => m.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))) {
    const min = Math.max(modifier.required ? 1 : 0, modifier.min_selections ?? 0);
    const max = modifier.max_selections ?? (modifier.group_type === "single" ? 1 : "");
    rows.push([
      "Modifier",
      (modifier.category_id && catName.get(modifier.category_id)) || "",
      (modifier.item_id && itemName.get(modifier.item_id)) || "",
      modifier.group_name?.trim() || "Extras",
      modifier.name,
      "",
      price(modifier.price_cents),
      "0",
      min > 0 ? "Yes" : "No",
      min,
      max,
      "",
      "",
      modifier.sort_order,
    ]);
  }

  return toCsv(rows);
}