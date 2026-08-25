import { describe, it, expect } from "vitest";
import { guessCategory, prepKindForItem } from "@/lib/cooking";
const cases: [string,string|null][] = [
 ["Chocolate Bar","Snacks"],["Capuccino","Hot Drinks"],["Crisps","Snacks"],["Flapjack","Biscuits"],
 ["Cookies/Biscuits","Biscuits"],["Red Bull","Drinks"],["RedBull Mojito","Mocktails"],["Orange Juice","Drinks"],
 ["Chicken Wrap","Wraps"],["Cheeseburger and Chips","Burgers"],["Hot Dog with Chips","Hot Dogs"],
 ["Chicken Paratha Roll","Paratha"],["Chana n rice","Cafe 1 Classics"],["Side salad","Salads"],
 ["Plain Croissant","Croissant"],["Fruit Pot","Fruit Pot"],["Oat Milk","Extras"],["Matcha","Hot Drinks"],
 ["Chicken Samosa","Samosas"],["Shepherd's Pie","Cafe 1 Classics"],["W chips","Chips"],["Monster Energy","Drinks"],
];
describe("guessCategory",()=>{for(const [n,e] of cases) it(n,()=>expect(guessCategory(n)).toBe(e));});

describe("prepKindForItem", () => {
  it("routes meals to cooking", () =>
    expect(prepKindForItem({ name: "Chicken curry", needs_cooking: true })).toBe("cook"));
  it("routes sandwiches and coffee to preparation", () => {
    expect(prepKindForItem({ name: "Chicken sandwich" })).toBe("prep");
    expect(prepKindForItem({ name: "Latte", prep_seconds: 120, matched: true })).toBe("prep");
  });
  it("routes explicitly zero-time and packaged items to no prep", () => {
    expect(prepKindForItem({ name: "Crisps", prep_seconds: 0, matched: true })).toBe("none");
    expect(prepKindForItem({ name: "Can of Coke" })).toBe("none");
  });
});
