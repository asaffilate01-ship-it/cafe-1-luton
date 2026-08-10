import { describe, expect, it } from "vitest";
import { extractHubOrders, hubOrderAction } from "./deliveroo-hub";

describe("extractHubOrders", () => {
  it("reads a typical Hub order list payload", () => {
    const orders = extractHubOrders({
      data: {
        orders: [
          {
            id: "abc-123",
            order_number: "F3K9",
            status: "accepted",
            fulfillment_type: "DELIVERY",
            customer: { first_name: "Sarah" },
            total: { fractional: 1450, currency: "GBP" },
            note_to_restaurant: "Leave at reception",
            items: [
              { name: "Chicken Burger", quantity: 2, modifiers: [{ name: "No mayo" }] },
              { item_name: "Regular Fries", qty: 1 },
            ],
          },
        ],
      },
    });

    expect(orders).toHaveLength(1);
    expect(orders[0]).toEqual({
      reference: "abc-123",
      status: "accepted",
      customerName: "Sarah",
      type: "delivery",
      totalCents: 1450,
      notes: "Leave at reception",
      items: [
        { name: "Chicken Burger", qty: 2, notes: "No mayo" },
        { name: "Regular Fries", qty: 1, notes: null },
      ],
    });
  });

  it("handles decimal and formatted money", () => {
    const build = (total: unknown) => ({
      reference: "A1",
      items: [{ name: "Tea", quantity: 1 }],
      total,
    });
    expect(extractHubOrders(build(11.4))[0]?.totalCents).toBe(1140);
    expect(extractHubOrders(build("£11.40"))[0]?.totalCents).toBe(1140);
    expect(extractHubOrders(build({ amount: "3.20" }))[0]?.totalCents).toBe(320);
  });

  it("detects collection orders", () => {
    const [order] = extractHubOrders({
      reference: "B2",
      order_type: "CUSTOMER_COLLECTION",
      items: [{ name: "Latte", quantity: 1 }],
    });
    expect(order?.type).toBe("collection");
  });

  it("normalises lifecycle status so placed and cancelled orders can be held or removed", () => {
    const [placed] = extractHubOrders({
      id: "GB:placed",
      order_status: "PLACED",
      total: 500,
      items: [{ name: "Tea", quantity: 1 }],
    });
    const [cancelled] = extractHubOrders({
      id: "GB:cancelled",
      state: { name: "CANCELLED" },
      total: 500,
      items: [{ name: "Tea", quantity: 1 }],
    });
    expect(placed?.status).toBe("placed");
    expect(cancelled?.status).toBe("cancelled");
    expect(hubOrderAction(placed?.status ?? null)).toBe("wait");
    expect(hubOrderAction(cancelled?.status ?? null)).toBe("cancel");
    expect(hubOrderAction("accepted")).toBe("ingest");
    expect(hubOrderAction(null)).toBe("ingest");
  });

  it("de-duplicates repeated orders in one payload", () => {
    const one = { reference: "C3", items: [{ name: "Roll", quantity: 1 }] };
    expect(extractHubOrders({ a: [one], b: [one] })).toHaveLength(1);
  });

  it("ignores payloads that are not orders", () => {
    expect(extractHubOrders({ notifications: [{ id: 1, text: "hello" }] })).toEqual([]);
    expect(extractHubOrders("nonsense")).toEqual([]);
    expect(extractHubOrders(null)).toEqual([]);
  });
});
