/**
 * Recognises house-tab intent written on a SumUp till sale.
 *
 * SumUp itself has no notion of a Cafe1 house tab, so the till operator writes
 * it on the sale note. Two shapes are understood:
 *   "TAB: Judge Khan"          -> the food goes to the kitchen unpaid, on tab
 *   "TAB PAID: Judge Khan"     -> the outstanding tab tickets are marked paid
 */

export type SumupTabIntent =
  | { kind: "open"; name: string }
  | { kind: "settle"; name: string }
  | null;

const SETTLE_RE =
  /\b(?:tab\s*(?:paid|settled|settle|closed|close)|settle\s*(?:the\s*)?tab|pay(?:ing|ment\s*for)?\s*(?:the\s*)?tab|close\s*(?:the\s*)?tab)\b\s*[:\-–]?\s*(.*)/i;

const OPEN_RE =
  /\b(?:tab|on\s*account|account|charge\s*to|pay\s*later|unpaid)\b\s*[:\-–]?\s*(.*)/i;

function cleanName(raw: string): string {
  return raw
    .split(/[·|\n\r]/)[0]
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[.,;\s]+$/, "")
    .trim()
    .slice(0, 60);
}

export function parseSumupTabIntent(note: string | null | undefined): SumupTabIntent {
  if (!note) return null;
  for (const part of note.split(/[·|\n\r]/)) {
    const chunk = part.trim();
    if (!chunk) continue;
    const settle = chunk.match(SETTLE_RE);
    if (settle) {
      const name = cleanName(settle[1] ?? "");
      if (name) return { kind: "settle", name };
      continue;
    }
    const open = chunk.match(OPEN_RE);
    if (open) {
      const name = cleanName(open[1] ?? "");
      if (name) return { kind: "open", name };
    }
  }
  return null;
}
