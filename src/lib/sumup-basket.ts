import { guessCategory } from "@/lib/cooking";

export type SumupSummaryLine = {
  name: string;
  qty: number;
  category_label: string | null;
};

/**
 * Some SumUp terminals never expose a basket on the transaction, only a
 * one-line `product_summary` such as "2 x Latte, Bacon Roll". The kitchen used
 * to get a single meaningless ticket line, so the summary is split back into
 * real lines with quantities and a guessed category.
 */
export function parseSumupProductSummary(summary: string | null | undefined): SumupSummaryLine[] {
  const text = (summary ?? "").trim();
  if (!text) return [];
  const parts = text
    .split(/\s*(?:,|;|\||\u2022|\n)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];

  const lines: SumupSummaryLine[] = [];
  for (const part of parts) {
    // "2 x Latte", "2x Latte", "Latte x2", "2 Latte"
    let qty = 1;
    let name = part;
    const leading = part.match(/^(\d{1,3})\s*(?:x|\u00d7|\*)?\s+(.+)$/i);
    const leadingTight = part.match(/^(\d{1,3})\s*(?:x|\u00d7|\*)\s*(.+)$/i);
    const trailing = part.match(/^(.+?)\s*(?:x|\u00d7|\*)\s*(\d{1,3})$/i);
    if (leadingTight) {
      qty = Number(leadingTight[1]);
      name = leadingTight[2];
    } else if (leading) {
      qty = Number(leading[1]);
      name = leading[2];
    } else if (trailing) {
      qty = Number(trailing[2]);
      name = trailing[1];
    }
    name = name.trim();
    if (!name || !/[a-z]/i.test(name)) continue;
    lines.push({
      name,
      qty: Math.min(99, Math.max(1, Number.isFinite(qty) ? qty : 1)),
      category_label: guessCategory(name),
    });
  }
  return lines;
}

/**
 * A ticket line is a placeholder when the sync had no basket and fell back to
 * the whole-sale summary. Those lines are safe to replace once the real basket
 * arrives from SumUp on a later sweep.
 */
export function isPlaceholderLine(line: {
  menu_item_id: string | null;
  category_label: string | null;
  name: string | null;
}): boolean {
  if (line.menu_item_id) return false;
  const name = (line.name ?? "").trim().toLowerCase();
  if (!name) return true;
  if (name === "sumup pos sale" || name === "item") return true;
  return !line.category_label && /,|\bx\s*\d|\d\s*x\b/i.test(name);
}
