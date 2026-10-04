// Step 1, search: turn what a buyer or farmer typed into a catalogue item.
// Closeness = the larger of (a) the share of three-letter pieces two words have in common and
// (b) 1 - edits / length of the longer word, where swapping two neighbouring letters is one edit. Items at 0.55 or above are kept, best first.

export interface CatalogueItem {
  id: string;
  category: string;
  nameEn: string;
  nameHi: string;
  baseUnit: "kg" | "litre" | "piece" | "dozen";
  shelfLifeHours: number;
  names: string[];
}

export interface SearchHit {
  item: CatalogueItem;
  closeness: number;
  /** The stored spelling that matched best. */
  matched: string;
  exact: boolean;
}

export interface SearchResult {
  hits: SearchHit[];
  /** Set when the best hit is not an exact match: ask "did you mean …". */
  didYouMean: CatalogueItem | null;
}

/** Lower-case, unify Hindi spellings (nukta, chandrabindu), drop punctuation and Latin accents. */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Latin accents only; Devanagari signs are outside this range
    .normalize("NFC")
    .toLowerCase()
    .replace(/़/g, "") // nukta: प्याज़ → प्याज
    .replace(/ँ/g, "ं") // chandrabindu → anusvara: मूँग → मूंग
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Trigrams of each word padded like pg_trgm ("  word "), as a set. */
export function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const word of s.split(" ")) {
    if (!word) continue;
    const chars = Array.from(`  ${word} `);
    for (let i = 0; i + 2 < chars.length; i++) out.add(chars[i] + chars[i + 1] + chars[i + 2]);
  }
  return out;
}

export function trigramShare(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

/**
 * Edit distance on whole characters: add, remove or change one letter, or swap two neighbouring
 * letters (a swap is one typing mistake, not two).
 */
export function levenshtein(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = new Array<number>(y.length + 1);
    cur[0] = i;
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[y.length];
}

export function editCloseness(a: string, b: string): number {
  const longer = Math.max(Array.from(a).length, Array.from(b).length);
  return longer === 0 ? 1 : 1 - levenshtein(a, b) / longer;
}

/** Closeness of two already-normalized strings, between 0 and 1. */
export function closeness(a: string, b: string): number {
  if (a === b) return 1;
  return Math.max(trigramShare(a, b), editCloseness(a, b));
}

/** Precomputed, normalized names for fast repeated searches. */
export function indexCatalogue(items: CatalogueItem[]) {
  return items.map((item) => ({
    item,
    names: Array.from(new Set([item.nameEn, item.nameHi, ...item.names].map(normalize).filter(Boolean))),
  }));
}

export type CatalogueIndex = ReturnType<typeof indexCatalogue>;

/**
 * Finds the items a query most likely means. A query of several words is also tried word by word,
 * so "fresh tamatar" still finds tomato.
 */
export function searchCatalogue(index: CatalogueIndex, query: string, cutoff = 0.55, limit = 5): SearchResult {
  const q = normalize(query);
  if (!q) return { hits: [], didYouMean: null };
  const variants = [q, ...q.split(" ").filter((w) => Array.from(w).length >= 3 && w !== q)];
  const hits: (SearchHit & { exactLevel: number })[] = [];
  for (const entry of index) {
    let best = 0;
    let matched = "";
    // 2: the whole query is a stored name; 1: one of its words is; 0: neither.
    let exactLevel = 0;
    for (const name of entry.names) {
      for (const v of variants) {
        const c = closeness(v, name);
        if (c > best || (c === best && name.length > matched.length)) {
          best = c;
          matched = name;
        }
        if (v === name) exactLevel = Math.max(exactLevel, v === q ? 2 : 1);
      }
    }
    if (best >= cutoff) hits.push({ item: entry.item, closeness: best, matched, exact: exactLevel > 0, exactLevel });
  }
  hits.sort((a, b) => b.exactLevel - a.exactLevel || b.closeness - a.closeness || a.item.nameEn.localeCompare(b.item.nameEn));
  const top = hits.slice(0, limit).map((h): SearchHit => ({ item: h.item, closeness: h.closeness, matched: h.matched, exact: h.exact }));
  return { hits: top, didYouMean: top.length && !top[0].exact ? top[0].item : null };
}
