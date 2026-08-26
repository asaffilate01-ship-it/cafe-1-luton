import { describe, expect, it } from "vitest";
import { ticketToText } from "@/lib/imin";

describe("iMin receipt branding", () => {
  it("prints the selected branch and its address in the receipt header", () => {
    const receipt = ticketToText({
      heading: "COUNTER",
      order_number: 42,
      branch_name: "Café 1 Futures House",
      address_lines: ["Futures House, The Moakes", "Luton, LU3 3QB"],
      website: "cafe1luton.co.uk",
      fulfilment: "Takeaway",
      lines: [{ name: "Coffee", qty: 1, price_cents: 300 }],
      total_cents: 300,
    });

    expect(receipt).toContain("CAFE 1");
    expect(receipt).toContain("CAFÉ 1 FUTURES HOUSE");
    expect(receipt).toContain("Futures House, The Moakes");
    expect(receipt).toContain("Luton, LU3 3QB");
    expect(receipt).toContain("cafe1luton.co.uk");
  });
});
