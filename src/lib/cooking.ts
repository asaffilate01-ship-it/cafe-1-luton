/**
 * Works out whether a line needs cooking when we can't match it to a menu item.
 * POS-typed names ("Lamb chops w ruce") never match our menu exactly, so the
 * kitchen was seeing hot food as cold. Normalise, then fall back to keywords.
 */
export function normaliseItemName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Words that almost always mean the line comes off the grill/fryer/hob. */
const COOKED_WORDS = [
  "lamb", "chop", "chops", "chicken", "curry", "rice", "biryani", "kebab",
  "burger", "steak", "grill", "grilled", "fried", "fry", "chips", "fish",
  "nugget", "nuggets", "sausage", "bacon", "egg", "eggs", "omelette", "beans",
  "breakfast", "toast", "toasted", "panini", "jacket", "potato", "wedges",
  "soup", "pasta", "pizza", "wrap", "hot", "roast", "mince", "keema", "karahi",
  "masala", "tikka", "kofta", "hash", "mushroom", "waffle", "pancake",
];

/** Words that override the above — these are cold even if they share a token. */
const COLD_WORDS = [
  "coke", "pepsi", "water", "juice", "smoothie", "coffee", "latte", "tea",
  "cappuccino", "americano", "mocha", "hot chocolate", "cake", "muffin",
  "cookie", "crisps", "chocolate", "bottle", "can ", "salad", "yoghurt",
  "yogurt", "fruit", "biscuit", "brownie", "flapjack", "croissant",
];

export function looksCooked(name: string): boolean {
  const n = normaliseItemName(name);
  if (!n) return false;
  if (COLD_WORDS.some((w) => n.includes(w.trim()))) return false;
  const tokens = new Set(n.split(" "));
  return COOKED_WORDS.some((w) => tokens.has(w));
}

/**
 * Best-effort lookup of a POS line against our menu names: exact normalised
 * match first, then the menu name whose words overlap the line the most.
 * The overlap has to be strong: "chicken panini" and "chicken samosa" share a
 * word but are different dishes, so a single shared word is never enough.
 */
export function fuzzyMenuKey(name: string, keys: string[]): string | null {
  const n = normaliseItemName(name);
  if (!n) return null;
  const exact = keys.find((k) => normaliseItemName(k) === n);
  if (exact) return exact;
  const tokens = n.split(" ").filter((t) => t.length > 2);
  if (!tokens.length) return null;
  // The last meaningful word is the dish itself ("panini", "samosa"); the rest
  // are usually fillings or sizes. It must match or we treat it as no match.
  const head = tokens[tokens.length - 1];
  let best: { key: string; score: number } | null = null;
  for (const key of keys) {
    const keyTokens = normaliseItemName(key).split(" ").filter((t) => t.length > 2);
    if (!keyTokens.length) continue;
    if (keyTokens[keyTokens.length - 1] !== head && !keyTokens.includes(head)) continue;
    const hits = keyTokens.filter((t) => tokens.includes(t)).length;
    const score = hits / Math.max(keyTokens.length, tokens.length);
    if (hits && (!best || score > best.score)) best = { key, score };
  }
  return best && best.score >= 0.6 ? best.key : null;
}
