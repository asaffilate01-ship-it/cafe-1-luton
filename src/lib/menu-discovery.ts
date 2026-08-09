export type MenuSearchItem = {
  name: string;
  description?: string | null;
};

/**
 * Make customer menu searches forgiving without changing the displayed copy.
 * Diacritics, punctuation and repeated whitespace are ignored, and every word
 * entered by the customer must occur somewhere in the item/category text.
 */
export function normaliseMenuSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-GB")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchesMenuQuery(item: MenuSearchItem, query: string, categoryName = ""): boolean {
  const terms = normaliseMenuSearch(query).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const haystack = normaliseMenuSearch(`${item.name} ${item.description ?? ""} ${categoryName}`);
  return terms.every((term) => haystack.includes(term));
}

export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
