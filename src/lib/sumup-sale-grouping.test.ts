import { describe, expect, it } from "vitest";
import {
  groupSumupSaleParts,
  normaliseSumupClientTransactionId,
  primarySumupSalePart,
  sumupSalePaymentMethod,
  sumupSaleTotalCents,
} from "./sumup-sale-grouping";

const saleBase = "urn:sumup:pos:sale:MCODE:DEVICE-123";

describe("SumUp POS sale grouping", () => {
  it("turns cash and card payment parts into one logical sale", () => {
    const cash = {
      id: "cash-transaction",
      amount: 5,
      payment_type: "CASH",
      client_transaction_id: `${saleBase};1`,
    };
    const card = {
      id: "card-transaction",
      amount: 7.5,
      payment_type: "POS",
      client_transaction_id: `${saleBase};2`,
    };

    const groups = groupSumupSaleParts([cash, card]);
    expect(groups).toHaveLength(1);
    expect(groups[0].saleKey).toBe(saleBase);
    expect(groups[0].paymentParts).toHaveLength(2);
    expect(sumupSaleTotalCents(groups[0].paymentParts)).toBe(1250);
    expect(sumupSalePaymentMethod(groups[0].paymentParts)).toBe("split");
    expect(primarySumupSalePart(groups[0].paymentParts)).toBe(card);
  });

  it("does not merge separate sales or count a repeated history row twice", () => {
    const first = {
      id: "first",
      amount: 4,
      payment_type: "POS",
      client_transaction_id: `${saleBase};1`,
    };
    const second = {
      id: "second",
      amount: 6,
      payment_type: "POS",
      client_transaction_id: "urn:sumup:pos:sale:MCODE:DEVICE-456;1",
    };
    const groups = groupSumupSaleParts([first, first, second]);
    expect(groups).toHaveLength(2);
    expect(groups[0].paymentParts).toHaveLength(1);
  });

  it("uses the provider transaction when SumUp supplies no client sale id", () => {
    expect(normaliseSumupClientTransactionId("  sale-123;2 ")).toBe("sale-123");
    expect(groupSumupSaleParts([{ id: "standalone", amount: 3 }])[0].saleKey).toBe(
      "transaction:standalone",
    );
  });
});
