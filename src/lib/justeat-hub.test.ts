import { describe, expect, it } from "vitest";

import { extractJustEatOrders, justEatOrderAction } from "@/lib/justeat-hub";

describe("justeat hub parsing", () => {
  it("extracts an order from a Partner Centre style payload", () => {
    const [order] = extractJustEatOrders({
      orders: [
        {
          friendly_id: "JE-8842",
          status: "accepted",
          order_type: "delivery",
          total: "£18.40",
          customer: { name: "Sam" },
          items: [
            { name: "Chicken Shawarma", quantity: 2, options: [{ name: "Extra chilli" }] },
          ],
        },
      ],
    });
    expect(order?.reference).toBe("JE-8842");
    expect(order?.totalCents).toBe(1840);
    expect(order?.items[0]).toMatchObject({ name: "Chicken Shawarma", qty: 2 });
    expect(order?.items[0]?.notes).toContain("Extra chilli");
  });

  it("labels a basket-less order as a Just Eat order", () => {
    const [order] = extractJustEatOrders({
      order_number: "JE-1",
      status: "accepted",
      total: 900,
      placed_at: "2026-08-13T10:00:00Z",
    });
    expect(order?.items[0]?.name).toBe("Just Eat order");
  });

  it("waits for acceptance and cancels rejected orders", () => {
    expect(justEatOrderAction("placed")).toBe("wait");
    expect(justEatOrderAction("cancelled")).toBe("cancel");
    expect(justEatOrderAction("accepted")).toBe("ingest");
  });

  it("ignores unrelated payloads", () => {
    expect(extractJustEatOrders({ ping: true })).toEqual([]);
  });
});
