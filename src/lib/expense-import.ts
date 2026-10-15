export type ImportedExpense = {
  expense_date: string;
  category: string;
  description: string;
  amount_cents: number;
  tax_included_cents: number;
  payment_method: string;
  provider_reference: string;
  invoice_reference: string;
  notes: string;
};

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normaliseHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findColumn(headers: string[], names: string[], required = false) {
  const index = headers.findIndex((header) => names.includes(header));
  if (required && index < 0) throw new Error(`CSV is missing the ${names[0]} column`);
  return index;
}

function parseMoney(value: string): number {
  const cleaned = value.replace(/[£$€\s,]/g, "").replace(/^\((.*)\)$/, "-$1");
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(Math.abs(amount) * 100);
}

function parseDate(value: string): string | null {
  const uk = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (uk) {
    const date = `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
    return Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? null : date;
  }
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso && !Number.isNaN(Date.parse(`${iso[1]}T00:00:00Z`)) ? iso[1] : null;
}

function paymentMethod(value: string): string {
  const normal = value.toLowerCase();
  if (normal.includes("cash")) return "cash";
  if (normal.includes("direct debit")) return "direct_debit";
  if (normal.includes("bank") || normal.includes("transfer")) return "bank_transfer";
  if (normal.includes("sumup")) return "sumup_card";
  if (normal.includes("card")) return "card";
  return "other";
}

function categoryFor(reason: string): string {
  const normal = reason.toLowerCase();
  if (/fee|commission|processing/.test(normal)) return "payment_fees";
  if (/clean|hygiene|saniti/.test(normal)) return "cleaning";
  if (/repair|maintenance/.test(normal)) return "repairs";
  if (/software|subscription|licen[cs]e/.test(normal)) return "software";
  if (/travel|fuel|courier|delivery/.test(normal)) return "travel_delivery";
  if (/marketing|advert|print/.test(normal)) return "marketing";
  if (/electric|gas|water|utility|broadband|phone/.test(normal)) return "utilities";
  if (/stock|food|ingredient|packaging|supply/.test(normal)) return "supplies";
  if (/equipment|utensil|smallware/.test(normal)) return "smallwares";
  return "other";
}

function stableReference(parts: string[]) {
  return parts
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|")
    .slice(0, 500);
}

/**
 * Parses the official SumUp Back Office expense CSV. The import uses a stable
 * source reference, so importing the same export twice cannot duplicate costs.
 */
export function parseSumupExpenseCsv(input: string): ImportedExpense[] {
  const rows = parseCsvRows(input.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("The SumUp expense CSV contains no data rows");
  const headers = rows[0].map(normaliseHeader);
  const date = findColumn(headers, ["date", "expense date"], true);
  const reason = findColumn(headers, ["reason", "description", "expense reason"], true);
  const total = findColumn(headers, ["total amount", "total", "amount"], true);
  const tax = findColumn(headers, ["vat", "tax", "vat amount"]);
  const payment = findColumn(headers, ["payment method", "method"]);
  const bill = findColumn(headers, ["bill number", "invoice number", "receipt number"]);
  const user = findColumn(headers, ["user", "staff", "employee"]);

  const output: ImportedExpense[] = [];
  for (const values of rows.slice(1)) {
    const expenseDate = parseDate(values[date] ?? "");
    const description = (values[reason] ?? "").trim();
    const amountCents = parseMoney(values[total] ?? "");
    if (!expenseDate || description.length < 2 || amountCents < 1) continue;
    const invoice = bill >= 0 ? (values[bill] ?? "").trim() : "";
    const method = payment >= 0 ? (values[payment] ?? "").trim() : "";
    const operator = user >= 0 ? (values[user] ?? "").trim() : "";
    output.push({
      expense_date: expenseDate,
      category: categoryFor(description),
      description,
      amount_cents: amountCents,
      tax_included_cents: tax >= 0 ? Math.min(amountCents, parseMoney(values[tax] ?? "")) : 0,
      payment_method: paymentMethod(method),
      provider_reference: stableReference([
        expenseDate,
        invoice,
        description,
        String(amountCents),
        method,
        operator,
      ]),
      invoice_reference: invoice,
      notes: operator ? `SumUp operator: ${operator}` : "Imported from SumUp expense history",
    });
  }
  if (!output.length) throw new Error("No valid expense rows were found in the SumUp CSV");
  return output;
}
