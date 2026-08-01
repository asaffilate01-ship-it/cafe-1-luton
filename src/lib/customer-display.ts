export const DISPLAY_CHANNEL = "cafe1-customer-display";

export type DisplayLine = { id: string; name: string; price_cents: number; qty: number };

export type DisplayMessage =
  | {
      type: "order";
      lines: DisplayLine[];
      subtotal: number;
      voucher_cents: number;
      discount_cents: number;
      due: number;
      fulfilment: string;
    }
  | {
      type: "paid";
      order_number: number;
      total: number;
      method: "cash" | "card" | "split" | "voucher";
    }
  | { type: "juror"; url: string }
  | { type: "idle" };

export function postToDisplay(msg: DisplayMessage) {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  const ch = new BroadcastChannel(DISPLAY_CHANNEL);
  ch.postMessage(msg);
  ch.close();
}
