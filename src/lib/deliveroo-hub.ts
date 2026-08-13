/**
 * Normalises order payloads captured from Deliveroo Restaurant Hub.
 *
 * The Hub watcher running in the shop forwards Hub's own API responses
 * verbatim rather than trying to understand them, so all interpretation
 * happens here where it can be tested and updated without anyone touching
 * the shop machine. Hub's field names differ between endpoints and change
 * over time, so every lookup tries a list of candidates and the whole thing
 * degrades gracefully instead of throwing.
 */

export type HubOrderLine = { name: string; qty: number; notes: string | null };

export type HubOrder = {
  reference: string;
  status: string | null;
  customerName: string | null;
  type: "delivery" | "collection";
  totalCents: number;
  notes: string | null;
  items: HubOrderLine[];
};

export function hubOrderAction(status: string | null): "ingest" | "wait" | "cancel" {
  const value = status?.trim().toLowerCase() ?? "";
  if (["cancelled", "canceled", "rejected"].includes(value)) return "cancel";
  if (["placed", "pending", "unconfirmed", "new"].includes(value)) return "wait";
  // Older Hub endpoints omit status from an otherwise complete accepted order.
  return "ingest";
}

type Json = unknown;

function isObject(value: Json): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** First non-empty value among the given keys, searched case-insensitively. */
function pick(source: Record<string, Json>, keys: string[]): Json {
  const lower = new Map(Object.keys(source).map((key) => [key.toLowerCase(), key]));
  for (const key of keys) {
    const actual = lower.get(key.toLowerCase());
    if (actual === undefined) continue;
    const value = source[actual];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

function asString(value: Json): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  if (isObject(value)) {
    const nested = pick(value, [
      "name",
      "first_name",
      "given_name",
      "display_name",
      "value",
      "text",
    ]);
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return null;
}

/** Hub reports money either as minor units, a decimal number, or "£12.34". */
function asCents(value: Json): number {
  if (typeof value === "number") {
    // Integers above 1000 with no decimal part are almost always minor units.
    return Number.isInteger(value) ? value : Math.round(value * 100);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) return 0;
    return Math.round(Number(cleaned) * 100) || 0;
  }
  if (isObject(value)) {
    const fractional = pick(value, ["fractional", "amount_minor", "minor_units"]);
    if (typeof fractional === "number") return Math.round(fractional);
    if (typeof fractional === "string") return Math.round(Number(fractional)) || 0;
    const amount = pick(value, ["amount", "value", "total"]);
    if (amount !== undefined) return asCents(amount);
  }
  return 0;
}

function asQty(value: Json): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9]/g, ""));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(50, Math.round(n));
}

function collectModifiers(source: Record<string, Json>): string | null {
  const raw = pick(source, ["modifiers", "options", "sub_items", "subitems", "addons", "extras"]);
  const parts: string[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const name = isObject(entry)
        ? asString(pick(entry, ["name", "title", "label", "item_name"]))
        : asString(entry);
      if (name) parts.push(name);
    }
  }
  const note = asString(
    pick(source, ["note", "notes", "instructions", "special_instructions", "customer_note"]),
  );
  if (note) parts.push(note);
  return parts.length ? parts.join(", ").slice(0, 200) : null;
}

function normaliseLine(entry: Json): HubOrderLine | null {
  if (!isObject(entry)) return null;
  const name = asString(
    pick(entry, ["name", "item_name", "title", "menu_item_name", "product_name", "label"]),
  );
  if (!name) return null;
  return {
    name: name.slice(0, 120),
    qty: asQty(pick(entry, ["quantity", "qty", "count", "unit_count"])),
    notes: collectModifiers(entry),
  };
}

function findItems(order: Record<string, Json>): HubOrderLine[] {
  const candidates = pick(order, [
    "items",
    "order_items",
    "lines",
    "line_items",
    "products",
    "dishes",
  ]);
  const list = Array.isArray(candidates) ? candidates : [];
  const lines: HubOrderLine[] = [];
  for (const entry of list) {
    const line = normaliseLine(entry);
    if (line) lines.push(line);
    if (lines.length >= 60) break;
  }
  return lines;
}

function findType(order: Record<string, Json>): "delivery" | "collection" {
  const raw = asString(
    pick(order, ["fulfillment_type", "fulfilment_type", "order_type", "type", "delivery_type"]),
  );
  if (raw && /collect|pick.?up|takeaway/i.test(raw)) return "collection";
  return "delivery";
}

/**
 * Hub's order-list endpoints often return the order summary with the basket
 * fetched separately, so requiring items would silently drop real orders.
 * An object counts as an order when it has a reference plus either readable
 * items or at least two other order-shaped fields.
 */
const ORDER_SIGNAL_KEYS = [
  "status",
  "order_status",
  "fulfillment_type",
  "fulfilment_type",
  "order_type",
  "delivery_type",
  "total",
  "order_total",
  "total_price",
  "gross_total",
  "customer",
  "consumer",
  "customer_name",
  "placed_at",
  "created_at",
  "prepare_for",
  "delivery",
  "asap",
];

function looksLikeOrder(value: Json): value is Record<string, Json> {
  if (!isObject(value)) return false;
  const ref = pick(value, [
    "order_number",
    "display_id",
    "friendly_id",
    "reference",
    "short_code",
    "id",
    "order_id",
  ]);
  if (ref === undefined) return false;
  const items = pick(value, ["items", "order_items", "lines", "line_items", "products", "dishes"]);
  if (Array.isArray(items) && items.length > 0) return true;
  const signals = ORDER_SIGNAL_KEYS.filter((key) => pick(value, [key]) !== undefined).length;
  return signals >= 2;
}

/** Walk an arbitrary payload and pull out every order-shaped object. */
function findOrderObjects(
  payload: Json,
  depth = 0,
  found: Record<string, Json>[] = [],
): Record<string, Json>[] {
  if (depth > 6 || found.length >= 30) return found;
  if (Array.isArray(payload)) {
    for (const entry of payload) findOrderObjects(entry, depth + 1, found);
    return found;
  }
  if (!isObject(payload)) return found;
  if (looksLikeOrder(payload)) {
    found.push(payload);
    return found;
  }
  for (const value of Object.values(payload)) findOrderObjects(value, depth + 1, found);
  return found;
}

export type HubParseOptions = { placeholderName?: string };

function normaliseOrder(
  order: Record<string, Json>,
  options: HubParseOptions = {},
): HubOrder | null {
  const found = findItems(order);
  const reference =
    asString(
      pick(order, [
        "id",
        "order_id",
        "order_number",
        "display_id",
        "friendly_id",
        "reference",
        "short_code",
      ]),
    ) ?? null;
  if (!reference) return null;
  // A ticket with a placeholder line still reaches the kitchen; a dropped
  // order does not. Hub often lists the basket on a separate call.
  const items = found.length
    ? found
    : [{ name: options.placeholderName ?? "Deliveroo order", qty: 1, notes: null }];

  const customer = pick(order, ["customer", "consumer", "customer_name", "recipient"]);
  const total = pick(order, [
    "total",
    "order_total",
    "total_price",
    "gross_total",
    "amount",
    "price",
  ]);

  return {
    reference: reference.replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 100),
    status:
      asString(pick(order, ["status", "order_status", "state", "order_state"]))
        ?.trim()
        .toLowerCase() ?? null,
    customerName: asString(customer)?.slice(0, 60) ?? null,
    type: findType(order),
    totalCents: asCents(total),
    notes:
      asString(
        pick(order, ["note_to_restaurant", "kitchen_notes", "notes", "customer_note"]),
      )?.slice(0, 500) ?? null,
    items,
  };
}

/**
 * Extract every order we can recognise from a raw Hub payload.
 * Unknown shapes yield an empty array rather than an error.
 */
export function extractHubOrders(payload: Json, options: HubParseOptions = {}): HubOrder[] {
  const seen = new Set<string>();
  const orders: HubOrder[] = [];
  for (const candidate of findOrderObjects(payload)) {
    const order = normaliseOrder(candidate, options);
    if (!order || seen.has(order.reference)) continue;
    seen.add(order.reference);
    orders.push(order);
  }
  return orders;
}
