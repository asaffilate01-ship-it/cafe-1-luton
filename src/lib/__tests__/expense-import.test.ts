import { describe, expect, it } from "vitest";
import { parseSumupExpenseCsv } from "../expense-import";

describe("SumUp expense CSV", () => {
  it("parses the official expense fields and UK dates", () => {
    const rows = parseSumupExpenseCsv(
      'Date,Reason,User,VAT,Total amount,Payment method,Bill number\n11/08/2026,"Cleaning, weekly",Amal,£1.20,£12.00,SumUp card,B-42\n',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      expense_date: "2026-08-11",
      description: "Cleaning, weekly",
      amount_cents: 1200,
      tax_included_cents: 120,
      payment_method: "sumup_card",
      invoice_reference: "B-42",
      category: "cleaning",
    });
  });

  it("creates the same deduplication reference for the same exported row", () => {
    const csv =
      "Date,Reason,Total,Payment method,Bill number\n2026-08-10,Card processing fee,2.15,Bank,FEE-1\n";
    expect(parseSumupExpenseCsv(csv)[0].provider_reference).toBe(
      parseSumupExpenseCsv(csv)[0].provider_reference,
    );
  });

  it("rejects files that do not contain expense columns", () => {
    expect(() => parseSumupExpenseCsv("foo,bar\na,b\n")).toThrow(/missing the date column/i);
  });
});
