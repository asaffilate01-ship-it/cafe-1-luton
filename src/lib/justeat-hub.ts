/**
 * Normalises order payloads captured from the Just Eat Partner Centre by the
 * in-shop watcher. Partner Centre's payload shapes are close enough to
 * Deliveroo Restaurant Hub's that the same tolerant extractor is reused; only
 * the placeholder line name differs so an order whose basket arrives on a
 * separate call still reaches the kitchen labelled correctly.
 */
import { extractHubOrders, hubOrderAction, type HubOrder } from "@/lib/deliveroo-hub";

export type { HubOrder as JustEatOrder };

export function extractJustEatOrders(payload: unknown): HubOrder[] {
  return extractHubOrders(payload, { placeholderName: "Just Eat order" });
}

export const justEatOrderAction = hubOrderAction;
