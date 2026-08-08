import { describe, expect, it } from "vitest";
import {
  buildSumUpCategoriesCsv,
  buildSumUpItemsCsv,
  buildSumUpModifiersCsv,
} from "@/lib/sumup-export";

const cats = [
  { id: "c1", name: "Hot Drinks", sort_order: 10, active: true },
  { id: "c2", name: "Hidden", sort_order: 20, active: false },
];
const items = [
  {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    category_id: "c1",
    name: 'Latte, "large"',
    description: null,
    price_cents: 350,
    barcode: null,
    active: true,
    sort_order: 10,
  },
  {
    id: "i2",
    category_id: "c1",
    name: "Off menu",
    description: null,
    price_cents: 100,
    barcode: null,
    active: false,
    sort_order: 20,
  },
];
const mods = [
  {
    id: "m1",
    category_id: "c1",
    item_id: null,
    name: "Oat milk",
    price_cents: 50,
    active: true,
    sort_order: 10,
    group_name: "Milk",
    group_type: "single",
    required: false,
    min_selections: 0,
    max_selections: null,
  },
];

describe("sumup export", () => {
  it("exports only active categories", () => {
    const csv = buildSumUpCategoriesCsv(cats);
    expect(csv).toContain("Hot Drinks,10");
    expect(csv).not.toContain("Hidden");
  });

  it("escapes item names and skips inactive items", () => {
    const csv = buildSumUpItemsCsv(cats, items);
    expect(csv).toContain('"Latte, ""large"""');
    expect(csv).toContain("Hot Drinks,3.50");
    expect(csv).not.toContain("Off menu");
  });

  it("prepends the required dine in / takeaway group", () => {
    const csv = buildSumUpModifiersCsv(cats, items, mods);
    const lines = csv.trim().split("\r\n");
    expect(lines[1]).toBe("Service type,Dine in,0.00,Yes,1,1,All,");
    expect(lines[2]).toBe("Service type,Takeaway,0.00,Yes,1,1,All,");
    expect(lines[3]).toBe("Milk,Oat milk,0.50,No,0,1,Hot Drinks,");
  });
});