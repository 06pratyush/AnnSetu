import { describe, expect, it } from "vitest";
import { checkHardRules, matchListings, scoreListing, trustScore, type ListingFacts, type MatchRequest } from "./engine";
import { DEFAULT_SETTINGS as S } from "./settings";

let seed = 4242;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const between = (a: number, b: number) => a + rnd() * (b - a);
const NOW = Date.UTC(2026, 9, 5, 4, 30);
const CENTER = { lat: 26.9, lng: 75.8 };
const KM = (6371 * Math.PI) / 180;
const near = (maxKm: number) => {
  const r = between(0, maxKm) / KM;
  const a = between(0, 2 * Math.PI);
  return { lat: CENTER.lat + r * Math.cos(a), lng: CENTER.lng + (r * Math.sin(a)) / Math.cos((CENTER.lat * Math.PI) / 180) };
};

function listing(p: Partial<ListingFacts> = {}): ListingFacts {
  const at = near(20);
  return {
    id: Math.floor(rnd() * 1e9).toString(36),
    itemId: "tomato",
    category: "vegetables",
    status: "active",
    farmerVerified: true,
    lat: at.lat,
    lng: at.lng,
    radiusKm: 40,
    availableBase: between(10, 300),
    minOrderBase: 1,
    priceBase: between(15, 40),
    harvestedAt: NOW - between(0, 60) * 3600_000,
    shelfLifeHours: 120,
    ordersCompleted: 20,
    ordersOnTime: 18,
    isOrganic: false,
    state: "Rajasthan",
    district: "Jaipur",
    ...p,
  };
}
const request = (p: Partial<MatchRequest> = {}): MatchRequest => ({
  itemId: "tomato",
  quantity: 5,
  ...CENTER,
  buyerType: rnd() < 0.5 ? "individual" : "industrial",
  maxKm: null,
  state: "Rajasthan",
  district: "Jaipur",
  now: NOW,
  ...p,
});

describe("trust: imaginary past orders give new farmers a fair start", () => {
  it("new farmer 0.80, one late order 0.73, a veteran with 180 of 200 on time 0.90", () => {
    expect(trustScore(0, 0, S)).toBeCloseTo(0.8, 2);
    expect(trustScore(1, 0, S)).toBeCloseTo(0.73, 2);
    expect(trustScore(200, 180, S)).toBeCloseTo(0.9, 2);
  });
});

describe("step 3, score: 100,000 tries each", () => {
  const better: [string, (l: ListingFacts) => ListingFacts][] = [
    ["cheaper", (l) => ({ ...l, priceBase: l.priceBase * 0.8 })],
    ["fresher", (l) => ({ ...l, harvestedAt: l.harvestedAt + 5 * 3600_000 })],
    ["nearer", (l) => ({ ...l, lat: (l.lat! + CENTER.lat) / 2, lng: (l.lng! + CENTER.lng) / 2 })],
    ["more reliable", (l) => ({ ...l, ordersOnTime: Math.min(l.ordersCompleted, l.ordersOnTime + 2) })],
  ];
  for (const [what, improve] of better) {
    it(`a ${what} listing never scores lower`, () => {
      for (let n = 0; n < 100_000; n++) {
        const l = listing({ ordersCompleted: Math.floor(between(0, 50)) });
        l.ordersOnTime = Math.floor(between(0, l.ordersCompleted));
        const req = request();
        const a = scoreListing(l, req, 45, S).score;
        const b = scoreListing(improve(l), req, 45, S).score;
        expect(b).toBeGreaterThanOrEqual(a);
      }
    });
  }
});

/**
 * Case 3, a busy morning: 300 households and 20 businesses want tomatoes; 30 farmers hold 1.1x the
 * kilos wanted. Three ways of handing out the list are compared.
 */
describe("Case 3, a busy morning", () => {
  it("only a list rebuilt from live stock on every request serves (almost) everyone", () => {
    seed = 77;
    const farms = Array.from({ length: 30 }, (_, i) => listing({ id: `f${i}`, availableBase: 0, radiusKm: 40, ordersCompleted: Math.floor(between(0, 80)) }));
    farms.forEach((f) => (f.ordersOnTime = Math.floor(f.ordersCompleted * between(0.6, 1))));
    const buyers = [
      ...Array.from({ length: 300 }, (_, i) => ({ id: `h${i}`, type: "individual" as const, qty: Math.round(between(2, 5)), at: near(15) })),
      ...Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, type: "industrial" as const, qty: Math.round(between(30, 100)), at: near(15) })),
    ].sort(() => rnd() - 0.5);
    const wanted = buyers.reduce((s, b) => s + b.qty, 0);
    // Stock 1.1x demand, split unevenly between farms.
    const weights = farms.map(() => between(0.2, 1));
    const wsum = weights.reduce((a, b) => a + b, 0);
    farms.forEach((f, i) => (f.availableBase = Math.round((1.1 * wanted * weights[i]) / wsum)));
    const total = farms.reduce((s, f) => s + f.availableBase, 0);
    const req = (b: (typeof buyers)[number]): MatchRequest => ({ ...request(), ...b.at, buyerType: b.type, quantity: b.qty });
    const rank = (stock: Map<string, number>, b: (typeof buyers)[number]) =>
      matchListings(farms.map((f) => ({ ...f, availableBase: stock.get(f.id)! })), req(b), [], () => 45, S);

    // A: list worked out once at 6 am, orders taken blindly, farms fill orders until they run out.
    const at6 = new Map(farms.map((f) => [f.id, f.availableBase]));
    const promised = new Map<string, { buyer: string; qty: number }[]>();
    for (const b of buyers) {
      const top = rank(at6, b)[0];
      if (top) promised.set(top.listing.id, [...(promised.get(top.listing.id) ?? []), { buyer: b.id, qty: b.qty }]);
    }
    let servedA = 0;
    let oversold = 0;
    let soldA = 0;
    const soldBy: number[] = [];
    for (const f of farms) {
      let left = f.availableBase;
      let sold = 0;
      for (const o of promised.get(f.id) ?? []) {
        if (o.qty <= left) {
          left -= o.qty;
          sold += o.qty;
          servedA++;
        } else oversold += o.qty;
      }
      soldA += sold;
      soldBy.push(sold);
    }
    const top5 = soldBy.sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0) / Math.max(1, soldA);

    // B: same 6 am list, stock checked only at payment; a buyer whose first choice is gone gives up.
    const stockB = new Map(at6);
    let servedB = 0;
    let firstGone = 0;
    for (const b of buyers) {
      const top = rank(at6, b)[0];
      if (!top) continue;
      if (stockB.get(top.listing.id)! >= b.qty) {
        stockB.set(top.listing.id, stockB.get(top.listing.id)! - b.qty);
        servedB++;
      } else firstGone++;
    }

    // C: list rebuilt from live stock for every buyer, reserve checked and subtracted in one step.
    const stockC = new Map(at6);
    let servedC = 0;
    for (const b of buyers) {
      let need = b.qty;
      for (const m of rank(stockC, b)) {
        const take = Math.min(need, stockC.get(m.listing.id)!);
        if (b.type === "individual" && take < need) continue;
        stockC.set(m.listing.id, stockC.get(m.listing.id)! - take);
        need -= take;
        if (need === 0) break;
      }
      if (need === 0) servedC++;
    }
    expect([...stockC.values()].every((v) => v >= 0)).toBe(true);

    const pct = (x: number) => `${Math.round(x * 100)}%`;
    console.log(
      `busy morning (${buyers.length} buyers, ${wanted} kg wanted, ${total} kg stock): ` +
        `A 6 am list, no checks: ${pct(servedA / buyers.length)} served, ${pct((total - soldA) / total)} of stock unsold, ${oversold} kg promised that did not exist, top 5 farms ${pct(top5)} of sales; ` +
        `B check at payment: ${pct(servedB / buyers.length)} served, ${pct(firstGone / buyers.length)} found their first choice gone; ` +
        `C live list + one-step reserve: ${pct(servedC / buyers.length)} served`,
    );
    expect(servedC / buyers.length).toBeGreaterThanOrEqual(0.95);
    expect(servedA).toBeLessThan(servedC);
    expect(servedB).toBeLessThan(servedC);
  });
});

describe("hard rules on the design's examples", () => {
  it("a household needs the whole amount from one farmer; a business may split", () => {
    const l = listing({ availableBase: 40, lat: CENTER.lat, lng: CENTER.lng });
    expect(checkHardRules(l, request({ buyerType: "individual", quantity: 60 }), [], S)).toBe("not_enough_stock");
    expect(checkHardRules(l, request({ buyerType: "industrial", quantity: 60 }), [], S)).toBeNull();
  });
});
