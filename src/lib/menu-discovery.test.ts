import { describe, expect, it } from "vitest";
import { formatCount, matchesMenuQuery, normaliseMenuSearch } from "./menu-discovery";

describe("menu discovery", () => {
  it("normalises punctuation, diacritics and whitespace", () => {
    expect(normaliseMenuSearch("  Café & CRÈME-brûlée  ")).toBe("cafe creme brulee");
  });

  it("matches every search word across item, description and category", () => {
    const item = { name: "Chicken Shawarma", description: "Served with salad" };
    expect(matchesMenuQuery(item, "shawarma salad", "Grill & Kebabs")).toBe(true);
    expect(matchesMenuQuery(item, "kebab chicken", "Grill & Kebabs")).toBe(true);
    expect(matchesMenuQuery(item, "vegan chicken", "Grill & Kebabs")).toBe(false);
  });

  it("formats accessible singular and plural count labels", () => {
    expect(formatCount(0, "item")).toBe("0 items");
    expect(formatCount(1, "item")).toBe("1 item");
    expect(formatCount(2, "match", "matches")).toBe("2 matches");
  });
});
