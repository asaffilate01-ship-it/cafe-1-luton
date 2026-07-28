/**
 * Short, human-readable handover code for an order (e.g. "C1-4821-K7Q").
 * Deterministic from the order id, so staff (KDS / ticket) and the customer
 * (order page) always see the exact same code without storing anything extra.
 */
export function orderCode(order: { id: string; order_number: number }): string {
  let h = 0;
  for (let i = 0; i < order.id.length; i++) h = (h * 31 + order.id.charCodeAt(i)) >>> 0;
  const suffix = h.toString(36).toUpperCase().slice(-3).padStart(3, "0");
  return `C1-${String(order.order_number).padStart(4, "0")}-${suffix}`;
}
