import { describe, expect, it } from "vitest";
import { canTransitionOrder } from "@/lib/order-state";

describe("order state machine", () => {
  it("allows the kitchen and delivery happy paths", () => {
    expect(canTransitionOrder("paid", "preparing")).toBe(true);
    expect(canTransitionOrder("preparing", "ready")).toBe(true);
    expect(canTransitionOrder("ready", "out_for_delivery")).toBe(true);
    expect(canTransitionOrder("out_for_delivery", "delivered")).toBe(true);
  });

  it("blocks skipping and reopening terminal states", () => {
    expect(canTransitionOrder("preparing", "completed")).toBe(false);
    expect(canTransitionOrder("completed", "preparing")).toBe(false);
    expect(canTransitionOrder("cancelled", "paid")).toBe(false);
  });
});
