/**
 * Parser for the order receipt the Deliveroo tablet sends to its ESC/POS
 * order printer. Pure and browser-safe so it can be unit tested directly.
 *
 * The tablet emits a plain-text receipt wrapped in ESC/POS control codes.
 * We strip the control bytes, then read the fields off the text. Layout
 * varies slightly by tablet build, so every rule here is tolerant and the
 * parser never throws — an unreadable receipt still produces a ticket with
 * the raw text attached so the kitchen is never silently missing an order.
 */

export type ParsedPrintLine = { name: string; qty: number; notes: string | null };

export type ParsedPrintOrder = {
  reference: string | null;
  customerName: string | null;
  type: "delivery" | "collection";
  totalCents: number;
  notes: string | null;
  items: ParsedPrintLine[];
  /** True when we found nothing usable and fell back to the raw receipt. */
  degraded: boolean;
};

/** Remove ESC/POS control sequences and non-printable bytes. */
export function stripEscPos(raw: string): string {
  return (
    raw
      // ESC @ , ESC ! n, ESC a n, GS ! n, GS V m ... — one- and two-arg escapes
      // Raw ESC/POS bytes are intentionally matched here before receipt parsing.
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b[@!ade=EGMRStV-][\s\S]?/g, "")
      // eslint-disable-next-line no-control-regex
      .replace(/\x1d[!BVfhwr][\s\S]?/g, "")
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\x21[\s\S]/g, "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
      .replace(/\r\n?/g, "\n")
  );
}

function toCents(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  return Math.round(Number(cleaned) * 100) || 0;
}

const ITEM_PATTERNS: RegExp[] = [
  /^(\d{1,2})\s*[x×]\s+(.*)$/i, // "2x Flat White"
  /^(\d{1,2})\s+(?![x×]\s)(\D.*)$/i, // "2 Flat White"
];

const SKIP_LINE =
  /^(deliveroo|order\s*(receipt|summary)|customer|thank|www\.|tel[:.]|vat|-{3,}|={3,}|\*{3,})/i;
const TOTAL_LINE = /^(order\s+)?total\b/i;
const SUBTOTAL_LINE = /^(sub\s*total|subtotal|delivery|service|fees?|tip)\b/i;
const NOTE_PREFIX = /^(\s*[-•*+]\s+|\s{2,}(?![-•*+]))/;

function detectType(text: string): "delivery" | "collection" {
  if (/\b(collection|pick\s*-?up|takeaway|customer\s+collect)\b/i.test(text)) return "collection";
  return "delivery";
}

function detectReference(text: string): string | null {
  const patterns = [
    /order\s*(?:id|no\.?|number|ref(?:erence)?)?\s*[:#]\s*([A-Z0-9-]{3,20})/i,
    /^#\s*([A-Z0-9-]{3,20})$/im,
    /\border\s+([A-Z0-9]{4,12})\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

function detectCustomer(text: string): string | null {
  const match = text.match(/^\s*(?:customer|name|for)\s*[:#]\s*(.+)$/im);
  const value = match?.[1]?.trim();
  if (!value) return null;
  // Deliveroo prints first name plus an initial; keep it short and tidy.
  return value.replace(/\s{2,}/g, " ").slice(0, 60);
}

function detectTotal(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]!;
    if (SUBTOTAL_LINE.test(line)) continue;
    if (!TOTAL_LINE.test(line)) continue;
    const money = line.match(/(\d+[.,]\d{2})/);
    if (money?.[1]) return toCents(money[1]);
  }
  return 0;
}

function detectNotes(lines: string[]): string | null {
  const collected: string[] = [];
  for (const line of lines) {
    const match = line.match(
      /^\s*(?:note[s]?\s+to\s+restaurant|kitchen\s+note[s]?|note[s]?|allerg\w*|cutlery)\s*[:#]\s*(.+)$/i,
    );
    if (match?.[1]?.trim()) collected.push(match[1].trim());
  }
  return collected.length ? collected.join(" · ").slice(0, 500) : null;
}

/** Parse a raw ESC/POS receipt captured from the Deliveroo tablet. */
export function parseDeliverooReceipt(raw: string): ParsedPrintOrder {
  const text = stripEscPos(raw);
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.trim().length > 0);

  const items: ParsedPrintLine[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (SKIP_LINE.test(trimmed) || TOTAL_LINE.test(trimmed) || SUBTOTAL_LINE.test(trimmed))
      continue;

    let matched = false;
    for (const pattern of ITEM_PATTERNS) {
      const match = trimmed.match(pattern);
      if (!match) continue;
      const qty = Math.min(50, Math.max(1, Number(match[1]) || 1));
      // Trailing price column, e.g. "2x Flat White        6.40"
      const name = (match[2] ?? "").replace(/\s{2,}[£$€]?\d+[.,]\d{2}\s*$/, "").trim();
      if (name) {
        items.push({ name: name.slice(0, 120), qty, notes: null });
        matched = true;
      }
      break;
    }
    if (matched) continue;

    // Indented or bulleted line directly under an item = a modifier for it.
    if (items.length && NOTE_PREFIX.test(line)) {
      const note = trimmed
        .replace(/^[-•*+]\s*/, "")
        .replace(/\s{2,}[£$€]?\d+[.,]\d{2}\s*$/, "")
        .trim();
      if (note) {
        const last = items[items.length - 1]!;
        last.notes = last.notes ? `${last.notes}, ${note}`.slice(0, 200) : note.slice(0, 200);
      }
    }
  }

  const degraded = items.length === 0;
  return {
    reference: detectReference(text),
    customerName: detectCustomer(text),
    type: detectType(text),
    totalCents: detectTotal(lines),
    notes: detectNotes(lines),
    items: degraded
      ? [{ name: "Deliveroo order — check tablet", qty: 1, notes: text.slice(0, 200) || null }]
      : items.slice(0, 60),
    degraded,
  };
}
