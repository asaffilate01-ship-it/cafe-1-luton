import { describe, expect, it } from "vitest";
import { isPlaceholderLine, parseSumupProductSummary } from "@/lib/sumup-basket";

describe("parseSumupProductSummary", () => {
  it("splits a summary into quantities and names", () => {
    expect(parseSumupProductSummary("2 x Latte, Bacon Roll")).toEqual([
      { name: "Latte", qty: 2, category_label: expect.anything() },
      { name: "Bacon Roll", qty: 1, category_label: expect.anything() },
    ]);
  });

  it("handles trailing quantities and separators", () => {
    const lines = parseSumupProductSummary("Chips x3 | Coke");
    expect(lines.map((l) => [l.name, l.qty])).toEqual([
      ["Chips", 3],
      ["Coke", 1],
    ]);
  });

  it("returns nothing for an empty summary", () => {
    expect(parseSumupProductSummary("")).toEqual([]);
  });
});

describe("isPlaceholderLine", () => {
  it("treats the generic sale line as a placeholder", () => {
    expect(
      isPlaceholderLine({ menu_item_id: null, category_label: null, name: "SumUp POS sale" }),
    ).toBe(true);
  });

  it("keeps real matched lines", () => {
    expect(isPlaceholderLine({ menu_item_id: "m1", category_label: null, name: "Latte" })).toBe(
      false,
    );
    expect(
      isPlaceholderLine({ menu_item_id: null, category_label: "Hot Drinks", name: "Latte" }),
    ).toBe(false);
  });
});
