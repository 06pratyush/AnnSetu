import { describe, expect, it } from "vitest";
import { SEED_CATALOGUE } from "./catalogue-data";
import { closeness, indexCatalogue, normalize, searchCatalogue } from "./search";

const index = indexCatalogue(SEED_CATALOGUE);
const top3 = (q: string) => searchCatalogue(index, q, 0.55, 3).hits.map((h) => h.item.id);

let seed = 20261004;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const LATIN = "abcdefghijklmnopqrstuvwxyz".split("");
const DEVANAGARI = Array.from("अआइईउऊएऐओऔकखगघचछजझटठडढणतथदधनपफबभमयरलवशषसहािीुूेैोौंः्");

/** One typing mistake: change, drop, add or swap a character, using letters of the same script. */
function typo(word: string): string {
  const chars = Array.from(word);
  const alphabet = /[ऀ-ॿ]/.test(word) ? DEVANAGARI : LATIN;
  const i = Math.floor(rnd() * chars.length);
  const op = Math.floor(rnd() * 4);
  if (op === 0) chars[i] = pick(alphabet.filter((c) => c !== chars[i]));
  else if (op === 1 && chars.length > 3) chars.splice(i, 1);
  else if (op === 2) chars.splice(i, 0, pick(alphabet));
  else if (i + 1 < chars.length) [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
  else chars[i] = pick(alphabet.filter((c) => c !== chars[i]));
  return chars.join("");
}

/** Spellings people actually type for each item: main English and Hindi names, 4+ characters. */
const targets = SEED_CATALOGUE.flatMap((item) =>
  Array.from(new Set([item.nameEn, item.nameHi, ...item.names].map(normalize)))
    .filter((n) => Array.from(n).length >= 4 && !item.id.startsWith("other"))
    .map((name) => ({ id: item.id, name })),
);

function hitRate(mistakes: number, tries: number) {
  let hits = 0;
  for (let n = 0; n < tries; n++) {
    const t = pick(targets);
    let q = t.name;
    for (let m = 0; m < mistakes; m++) q = typo(q);
    if (top3(q).includes(t.id)) hits++;
  }
  return hits / tries;
}

describe("step 1, search", () => {
  it("closeness: identical is 1, the design's 'tamatr' is close to 'tamatar'", () => {
    expect(closeness("tomato", "tomato")).toBe(1);
    expect(closeness("tamatr", "tamatar")).toBeGreaterThan(0.8);
  });

  it("Case 1: 'tamatr' resolves to tomato and asks 'did you mean'", () => {
    const r = searchCatalogue(index, "tamatr");
    expect(r.hits[0].item.id).toBe("tomato");
    expect(r.didYouMean?.id).toBe("tomato");
  });

  it("an exact name needs no 'did you mean'", () => {
    const r = searchCatalogue(index, "Palak");
    expect(r.hits[0].item.id).toBe("spinach");
    expect(r.didYouMean).toBeNull();
  });

  const realWorld: [string, string][] = [
    ["tamatr", "tomato"], ["tomatos", "tomato"], ["टमाटर", "tomato"], ["gehoon", "wheat"], ["gehun", "wheat"], ["गेहूं", "wheat"],
    ["प्याज", "onion"], ["pyaaz", "onion"], ["piyaaz", "onion"], ["kanda", "onion"], ["aaloo", "potato"], ["आलु", "potato"],
    ["bhindee", "okra"], ["ladies finger", "okra"], ["baigan", "brinjal"], ["gobi", "cauliflower"], ["palak", "spinach"],
    ["dhaniya", "coriander-leaves"], ["lehsun", "garlic"], ["adrak", "ginger"], ["kheera", "cucumber"], ["louki", "bottle-gourd"],
    ["karela", "bitter-gourd"], ["muli", "radish"], ["mutter", "green-peas"], ["kela", "banana"], ["angur", "grapes"],
    ["papita", "papaya"], ["amrood", "guava"], ["anaar", "pomegranate"], ["nimbu", "lemon"], ["chawal", "rice"],
    ["makai", "maize"], ["arhar dal", "tur"], ["moong dal", "moong"], ["haldi", "turmeric"], ["jeera", "cumin"],
    ["moongfali", "groundnut"], ["sarson", "mustard"], ["doodh", "milk"], ["dahi", "curd"], ["गुड़", "jaggery"],
  ];
  it(`finds all ${realWorld.length} real-world spellings first`, () => {
    const misses = realWorld.filter(([q, id]) => searchCatalogue(index, q).hits[0]?.item.id !== id);
    expect(misses).toEqual([]);
  });

  it("one typing mistake: right item in the first three at least 95 times in 100 (2,000 tries)", () => {
    const rate = hitRate(1, 2000);
    console.log(`one mistake: ${(rate * 100).toFixed(1)}% in top 3`);
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });

  it("two typing mistakes (2,000 tries), reported", () => {
    const rate = hitRate(2, 2000);
    console.log(`two mistakes: ${(rate * 100).toFixed(1)}% in top 3`);
    expect(rate).toBeGreaterThanOrEqual(0.85);
  });

  const notProduce = (
    "car bus bike phone mobile laptop computer table chair school college teacher student house home door window road " +
    "city village river mountain cloud rain sun moon star book pen pencil paper bag shoe shirt pant saree dress cap watch " +
    "clock money bank card ticket train plane ship doctor nurse hospital medicine police court lawyer temple mosque church " +
    "market shop office factory engine motor tyre wheel petrol diesel cement brick steel iron gold silver copper plastic glass " +
    "cotton wool silk leather soap shampoo toothpaste brush comb mirror bed pillow blanket fan light bulb switch wire battery " +
    "charger cable television radio camera music song dance movie film game cricket football hockey tennis chess ludo kite " +
    "dog cat cow buffalo goat sheep horse donkey camel elephant tiger lion monkey bird crow parrot pigeon fish frog snake ant " +
    "kitchen bucket mug plate spoon knife fork stove gas cylinder lock key gate wall roof floor garden tree grass flower leaf " +
    "kursi mez kitab kalam ghar sadak shahar gaon nadi pahad baadal barish suraj chand tara kapda joota topi ghadi paisa " +
    "naukri dukaan daftar gaadi rail jahaj daaktar dawai mandir masjid bazaar khel gaana naach kutta billi gaay bakri ghoda " +
    "hathi bandar chidiya machhli saanp chammach thaali chaku taala chabi darwaza khidki deewar chhat zameen ped phool patta " +
    "pani hawa aag mitti pathar lakdi loha sona chandi sheesha"
  ).split(" ");

  it(`words that are not produce (${notProduce.length}) only ever get a "did you mean", reported`, () => {
    const results = notProduce.map((w) => ({ w, r: searchCatalogue(index, w) }));
    const suggested = results.filter((x) => x.r.hits.length > 0);
    const strong = suggested.filter((x) => x.r.hits[0].closeness >= 0.75);
    // A non-exact match is never applied without the buyer's tap, so these show a suggestion only.
    expect(suggested.every((x) => x.r.didYouMean !== null)).toBe(true);
    console.log(
      `non-produce words with a suggestion: ${suggested.length}/${notProduce.length} = ${((suggested.length / notProduce.length) * 100).toFixed(1)}%; ` +
        `strong suggestions (closeness >= 0.75): ${strong.length} = ${((strong.length / notProduce.length) * 100).toFixed(1)}% (${strong.map((x) => `${x.w}→${x.r.hits[0].item.id}`).join(", ")})`,
    );
    // Regression bound only: these are real one-letter neighbours (money/honey, card/curd).
    expect(strong.length / notProduce.length).toBeLessThan(0.1);
  });
});
