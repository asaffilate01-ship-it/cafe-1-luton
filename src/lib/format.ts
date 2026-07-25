export const money = (cents: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(cents / 100);

export const statusLabel = (s: string) =>
  ({
    pending_payment: "Awaiting payment",
    paid: "Paid",
    preparing: "Preparing",
    ready: "Ready",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
    refunded: "Refunded",
  })[s] ?? s;