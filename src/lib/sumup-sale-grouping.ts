export type SumupSalePart = {
  id: string;
  amount: number;
  payment_type?: string;
  client_transaction_id?: string;
};

/**
 * SumUp identifies payment parts from one POS sale with a shared client id and
 * a trailing sequence such as `;1` / `;2`. The sequence identifies the payment
 * part, not another kitchen order.
 */
export function normaliseSumupClientTransactionId(value?: string | null) {
  const clean = value?.trim();
  return clean ? clean.replace(/;\d+$/, "") : null;
}

export function sumupLogicalSaleKey(part: Pick<SumupSalePart, "id" | "client_transaction_id">) {
  return normaliseSumupClientTransactionId(part.client_transaction_id) ?? `transaction:${part.id}`;
}

/** Group distinct payment rows into the one sale that must become one KDS ticket. */
export function groupSumupSaleParts<T extends SumupSalePart>(parts: T[]) {
  const groups = new Map<string, T[]>();
  const seenTransactions = new Set<string>();
  for (const part of parts) {
    if (seenTransactions.has(part.id)) continue;
    seenTransactions.add(part.id);
    const key = sumupLogicalSaleKey(part);
    const group = groups.get(key) ?? [];
    group.push(part);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([saleKey, paymentParts]) => ({ saleKey, paymentParts }));
}

export function sumupSaleTotalCents(parts: SumupSalePart[]) {
  return parts.reduce((total, part) => {
    const amount = Number(part.amount);
    return total + (Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0);
  }, 0);
}

export function sumupSalePaymentMethod(parts: SumupSalePart[]): "cash" | "card" | "split" {
  const hasCash = parts.some((part) => part.payment_type?.trim().toUpperCase() === "CASH");
  const hasCard = parts.some((part) => part.payment_type?.trim().toUpperCase() !== "CASH");
  if (hasCash && hasCard) return "split";
  return hasCash ? "cash" : "card";
}

/** Keep the card transaction as the order's provider reference for refunds/reconciliation. */
export function primarySumupSalePart<T extends SumupSalePart>(parts: T[]) {
  const primary = parts.find((part) => part.payment_type?.trim().toUpperCase() !== "CASH");
  if (primary) return primary;
  if (!parts[0]) throw new Error("A SumUp sale must contain at least one payment part");
  return parts[0];
}
