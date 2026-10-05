// Step 1, search. The guarantee: a name typed with one mistake (a letter added, dropped, changed,
// or two neighbouring letters swapped) is still found, for every stored spelling of 3 or more letters.
import { describe } from "vitest";
import { SEED_CATALOGUE } from "@/lib/matching/catalogue-data";
import { editCloseness, indexCatalogue, levenshtein, normalize, searchCatalogue } from "@/lib/matching/search";
import { DEFAULT_SETTINGS } from "@/lib/matching/settings";
import { suite } from "./z3";

const t = suite("search", "Search (step 1)");

/** Every string one typing mistake away from w, over the given letters. */
function oneMistake(w: string, letters: string[]): string[] {
  const c = Array.from(w);
  const out = new Set<string>();
  for (let i = 0; i <= c.length; i++) for (const l of letters) out.add([...c.slice(0, i), l, ...c.slice(i)].join("")); // added
  for (let i = 0; i < c.length; i++) {
    out.add([...c.slice(0, i), ...c.slice(i + 1)].join("")); // dropped
    for (const l of letters) if (l !== c[i]) out.add([...c.slice(0, i), l, ...c.slice(i + 1)].join("")); // changed
    if (i + 1 < c.length && c[i] !== c[i + 1]) out.add([...c.slice(0, i), c[i + 1], c[i], ...c.slice(i + 2)].join("")); // swapped
  }
  out.delete(w);
  return [...out];
}

describe("one mistake", () => {
  t.theorem(
    "S1",
    "One mistake in a name of 3 or more letters keeps it above the 0.55 cut-off",
    "If the edit distance d ≤ 1 and the longer of the two words has L ≥ 3 letters, then 1 − d/L ≥ 2/3 > 0.55; closeness is the larger of this and the trigram share, so it is at least 2/3.",
    (Z) => {
      const [d, L, cutoff] = ["d", "L", "cutoff"].map((n) => Z.Real.const(n));
      const closeness = Z.Real.val(1).sub(d.div(L));
      return { given: [d.ge(0), d.le(1), L.ge(3), cutoff.le(0.55)], claim: Z.And(closeness.ge(Z.Real.val("2/3")), closeness.ge(cutoff)), watch: { d, L } };
    },
  );

  t.check("S2", "Lemma: the edit-distance code counts one mistake as at most one edit (every word of up to 6 letters over a, b, c)", () => {
    const words: string[] = [""];
    for (let len = 1; len <= 6; len++) for (const w of words.filter((x) => x.length === len - 1)) for (const l of "abc") words.push(w + l);
    let pairs = 0;
    const bad: string[] = [];
    for (const w of words) {
      if (levenshtein(w, w) !== 0) bad.push(`${w}→${w}`);
      for (const v of oneMistake(w, ["a", "b", "c"])) {
        pairs++;
        const d = levenshtein(w, v);
        if (d !== 1 || levenshtein(v, w) !== d) bad.push(`${w}→${v}: ${d}`);
      }
    }
    return { passed: bad.length === 0, detail: `${words.length.toLocaleString("en-IN")} words, ${pairs.toLocaleString("en-IN")} one-mistake pairs: ${bad.length ? bad.slice(0, 5).join(", ") : "each exactly one edit, in both directions"}` };
  });

  t.check(
    "S3",
    "Every one-mistake version of every catalogue spelling of 3+ letters still finds its item",
    () => {
      const index = indexCatalogue(SEED_CATALOGUE);
      let tried = 0;
      let first = 0;
      let top3 = 0;
      let top6 = 0;
      const missed: string[] = [];
      for (const entry of index) {
        for (const name of entry.names) {
          const chars = Array.from(name);
          if (chars.length < 3) continue;
          const latin = /^[a-z ]+$/.test(name);
          // Typos from the word's own letters plus common neighbours (a few vowels, or Hindi vowel signs).
          const letters = [...new Set([...chars.filter((ch) => ch !== " "), ...(latin ? ["a", "e", "i", "o", "u"] : ["ा", "ि", "ी", "े"])])];
          for (const typo of oneMistake(name, letters)) {
            if (normalize(typo) !== typo || !typo.trim()) continue; // must reach the search as typed
            tried++;
            const res = searchCatalogue(index, typo, DEFAULT_SETTINGS.searchCutoff, 100);
            const rank = res.hits.findIndex((h) => h.item.id === entry.item.id);
            if (rank < 0) missed.push(`${name} → ${typo} (closeness ${editCloseness(typo, name).toFixed(2)})`);
            else {
              if (rank === 0) first++;
              if (rank < 3) top3++;
              if (rank < 6) top6++;
            }
          }
        }
      }
      const pct = (n: number) => `${((100 * n) / tried).toFixed(1)}%`;
      return {
        passed: missed.length === 0,
        detail: missed.length
          ? `${missed.length} not found, e.g. ${missed.slice(0, 3).join("; ")}`
          : `${tried.toLocaleString("en-IN")} typos: every one finds its item. Ranked first ${pct(first)}, in the first 3 ${pct(top3)}, in the 6 the item picker shows ${pct(top6)}`,
      };
    },
    600_000,
  );
});
