import { describe, expect, it } from "vitest";

import { extractUberEatsOrders, uberEatsOrderAction } from "@/lib/ubereats-hub";

describe("Uber Eats Manager payload parsing", () => {
  it("extracts accepted orders and their options", () => {
    const [order] = extractUberEatsOrders({
      orders: [
        {
          display_id: "UE-2048",
          status: "accepted",
          fulfillment_type: "delivery",
          total: { amount: "21.50" },
          customer: { display_name: "Alex" },
          items: [{ title: "Chicken Wrap", quantity: 2, modifiers: [{ name: "Hot" }] }],
        },
      ],
    });
    expect(order?.reference).toBe("UE-2048");
    expect(order?.totalCents).toBe(2150);
    expect(order?.items[0]).toMatchObject({ name: "Chicken Wrap", qty: 2 });
    expect(order?.items[0]?.notes).toContain("Hot");
  });

  it("labels basket-less tickets and honours status", () => {
    const [order] = extractUberEatsOrders({
      order_number: "UE-1",
      status: "accepted",
      total: 900,
      placed_at: "2026-08-25T10:00:00Z",
    });
    expect(order?.items[0]?.name).toBe("Uber Eats order");
    expect(uberEatsOrderAction("cancelled")).toBe("cancel");
    expect(uberEatsOrderAction("accepted")).toBe("ingest");
  });
});
