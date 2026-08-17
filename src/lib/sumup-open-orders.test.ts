import { describe, expect, it } from "vitest";
import { extractSumupOpenOrders, sumupOpenOrderSaleKey } from "./sumup-open-orders";

describe("sumup open orders", () => {
  it("normalises an open tab with line notes", () => {
    const [order] = extractSumupOpenOrders({
      items: [
        {
          id: "abc",
          customer_name: "Judge Khan",
          note: "TAB: Judge Khan",
          products: [
            { name: "Latte", quantity: 2, price: 3.2, comment: "extra hot" },
            { name: "Toast", quantity: 1, price: 2 },
          ],
        },
      ],
    });
    expect(order.id).toBe("abc");
    expect(order.name).toBe("Judge Khan");
    expect(order.totalCents).toBe(840);
    expect(order.note).toContain("Latte: extra hot");
    expect(order.products[0].note).toBe("extra hot");
  });

  it("prefers the stated total and skips unusable rows", () => {
    const orders = extractSumupOpenOrders([{ id: "x", total_amount: 12.5 }, { foo: 1 }]);
    expect(orders).toHaveLength(1);
    expect(orders[0].totalCents).toBe(1250);
    expect(sumupOpenOrderSaleKey("x")).toBe("open:x");
  });
});
