import { describe, expect, it } from "vitest";
import { parseDeliverooReceipt, stripEscPos } from "./deliveroo-print";

const RECEIPT =
  "\x1b@\x1b!8DELIVEROO\n\x1b!\x00Order #F3K9\nCustomer: Sarah M\nDELIVERY\n\n" +
  "2x Chicken Burger        11.00\n" +
  "  - No mayo\n" +
  "  - Extra cheese\n" +
  "1 Regular Fries           3.50\n" +
  "Subtotal                 14.50\n" +
  "Total                   £14.50\n" +
  "Notes: Leave at reception\n\x1dV\x00";

describe("parseDeliverooReceipt", () => {
  it("strips ESC/POS control bytes", () => {
    expect(stripEscPos(RECEIPT)).not.toMatch(/\x1b|\x1d/);
  });

  it("reads reference, customer, items and total", () => {
    const parsed = parseDeliverooReceipt(RECEIPT);
    expect(parsed.reference).toBe("F3K9");
    expect(parsed.customerName).toBe("Sarah M");
    expect(parsed.type).toBe("delivery");
    expect(parsed.totalCents).toBe(1450);
    expect(parsed.notes).toBe("Leave at reception");
    expect(parsed.items).toEqual([
      { name: "Chicken Burger", qty: 2, notes: "No mayo, Extra cheese" },
      { name: "Regular Fries", qty: 1, notes: null },
    ]);
    expect(parsed.degraded).toBe(false);
  });

  it("detects collection orders", () => {
    expect(parseDeliverooReceipt("Order #A1B2\nCOLLECTION\n1x Latte").type).toBe("collection");
  });

  it("ignores the subtotal when reading the total", () => {
    expect(parseDeliverooReceipt("1x Tea\nSubtotal 2.00\nTotal 9.99").totalCents).toBe(999);
  });

  it("never loses an unreadable receipt", () => {
    const parsed = parseDeliverooReceipt("???garbled???");
    expect(parsed.degraded).toBe(true);
    expect(parsed.items).toHaveLength(1);
  });
});
