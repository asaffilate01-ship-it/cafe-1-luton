import { extractHubOrders, hubOrderAction, type HubOrder } from "@/lib/deliveroo-hub";

export type { HubOrder as UberEatsOrder };

/** Tolerant parser for payloads observed in Uber Eats Manager. */
export function extractUberEatsOrders(payload: unknown): HubOrder[] {
  return extractHubOrders(payload, { placeholderName: "Uber Eats order" });
}

export const uberEatsOrderAction = hubOrderAction;
