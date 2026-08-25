import { jsPDF } from "jspdf";

type Order = {
  id: string;
  order_number: number;
  total_cents: number;
  refunded_cents: number;
  customer_name: string;
  type: string;
  payment_status: string;
  created_at: string;
};
type Item = { order_id: string; name: string; qty: number; unit_price_cents: number };
type Payment = {
  id: string;
  amount_cents: number;
  method: string;
  reference: string | null;
  created_at: string;
};

const gbp = (c: number) => `GBP ${(c / 100).toFixed(2)}`;

export function buildStatementPdf(opts: {
  account: { name: string; contact_name?: string | null; contact_email?: string | null };
  orders: Order[];
  items: Item[];
  payments: Payment[];
}) {
  const { account, orders, items, payments } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const left = 48;
  const right = 547;
  let y = 56;

  const line = (text: string, x = left, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text, x, y);
  };
  const rightText = (text: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text, right, y, { align: "right" });
  };
  const page = () => {
    if (y > 780) {
      doc.addPage();
      y = 56;
    }
  };

  doc.setTextColor(200, 30, 30);
  line("Cafe 1", left, 22, true);
  doc.setTextColor(30, 30, 30);
  rightText("TAB STATEMENT", 14, true);
  y += 16;
  doc.setTextColor(110, 110, 110);
  line("Luton Crown Court, LU1 2AA", left, 9);
  rightText(new Date().toLocaleDateString("en-GB"), 9);
  doc.setTextColor(30, 30, 30);
  y += 24;

  line(account.name, left, 12, true);
  y += 14;
  if (account.contact_name) {
    line(account.contact_name, left, 10);
    y += 12;
  }
  if (account.contact_email) {
    line(account.contact_email, left, 10);
    y += 12;
  }
  line("Account access code is stored securely and is not printed.", left, 9);
  y += 24;

  const onTab = orders.filter((o) => o.payment_status === "on_account");
  const charges = onTab.reduce(
    (sum, order) => sum + Math.max(0, order.total_cents - order.refunded_cents),
    0,
  );
  const paidOff = payments.reduce((s, p) => s + p.amount_cents, 0);
  const balance = Math.max(charges - paidOff, 0);

  doc.setDrawColor(220, 220, 220);
  doc.line(left, y, right, y);
  y += 20;

  line("Unsettled charges", left, 12, true);
  y += 16;
  if (onTab.length === 0) {
    line("Nothing outstanding.", left, 10);
    y += 14;
  }
  for (const o of onTab) {
    page();
    line(
      `#${o.order_number}  ${new Date(o.created_at).toLocaleString("en-GB")}  ${o.customer_name}`,
      left,
      10,
      true,
    );
    rightText(gbp(Math.max(0, o.total_cents - o.refunded_cents)), 10, true);
    y += 13;
    for (const it of items.filter((i) => i.order_id === o.id)) {
      page();
      doc.setTextColor(110, 110, 110);
      line(`   ${it.qty} x ${it.name}`, left, 9);
      rightText(gbp(it.qty * it.unit_price_cents), 9);
      doc.setTextColor(30, 30, 30);
      y += 11;
    }
    y += 6;
  }

  if (payments.length) {
    y += 10;
    page();
    line("Payments received", left, 12, true);
    y += 16;
    for (const p of payments) {
      page();
      line(
        `${new Date(p.created_at).toLocaleDateString("en-GB")}  ${p.method.replace("_", " ")}${p.reference ? ` - ${p.reference}` : ""}`,
        left,
        10,
      );
      rightText(`- ${gbp(p.amount_cents)}`, 10);
      y += 13;
    }
  }

  y += 16;
  page();
  doc.setDrawColor(220, 220, 220);
  doc.line(left, y, right, y);
  y += 20;
  line("Total charges", left, 10);
  rightText(gbp(charges), 10);
  y += 14;
  line("Payments received", left, 10);
  rightText(`- ${gbp(paidOff)}`, 10);
  y += 18;
  doc.setTextColor(200, 30, 30);
  line("Balance due", left, 14, true);
  rightText(gbp(balance), 14, true);
  doc.setTextColor(110, 110, 110);
  y += 26;
  line("Please settle weekly. Thank you for your custom.", left, 9);

  const safe = account.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`cafe1-statement-${safe}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
