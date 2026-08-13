import { describe, expect, it } from "vitest";
import { parseSumupTabIntent } from "./sumup-tab";

describe("parseSumupTabIntent", () => {
  it("reads an open tab note", () => {
    expect(parseSumupTabIntent("TAB: Judge Khan")).toEqual({ kind: "open", name: "Judge Khan" });
    expect(parseSumupTabIntent("Latte · on account - Court Office")).toEqual({
      kind: "open",
      name: "Court Office",
    });
  });

  it("reads a settlement note", () => {
    expect(parseSumupTabIntent("TAB PAID: Judge Khan")).toEqual({
      kind: "settle",
      name: "Judge Khan",
    });
    expect(parseSumupTabIntent("settle tab — Court Office")).toEqual({
      kind: "settle",
      name: "Court Office",
    });
  });

  it("ignores ordinary notes", () => {
    expect(parseSumupTabIntent("no mayo")).toBeNull();
    expect(parseSumupTabIntent(null)).toBeNull();
    expect(parseSumupTabIntent("tab")).toBeNull();
  });
});
