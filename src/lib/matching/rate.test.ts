import { describe, expect, it } from "vitest";
import { breakEvenQty, suggestRate, type RateInputs } from "./rate";
import { DEFAULT_SETTINGS as S } from "./settings";

// Case 1 from the design: 60 kg of tomatoes, mandi Rs 15, shop Rs 45, one Rs 520 trip, demand = supply.
const case1: RateInputs = {
  mandi: 15,
  shop: 45,
  tripCost: 520,
  tripQty: 60,
  demandQty: 1000,
  supplyQty: 1000,
  demandRequests: 50,
  demandMultiplier: 1,
  lifeLeft: 0.9,
};
const price = (i: Partial<RateInputs>) => {
  const r = suggestRate({ ...case1, ...i }, S);
  if (!r.ok) throw new Error("no price");
  return r.price;
};

describe("rate suggestion: the design's worked examples", () => {
  it("Case 1 suggests Rs 24.90", () => {
    const r = suggestRate(case1, S);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.price).toBe(24.9);
    const step = (k: string) => r.steps.find((s) => s.key === k)!.value;
    expect(step("deliveryPerUnit")).toBeCloseTo(8.67, 2);
    expect(step("highest")).toBeCloseTo(36.33, 2);
    expect(step("room")).toBeCloseTo(21.33, 2);
    expect(step("start")).toBeCloseTo(25.67, 2);
  });
  it("Case 1 leaves both sides better off: farmer +66%, restaurant -25% vs the shop", () => {
    expect(24.9 / 15 - 1).toBeCloseTo(0.66, 2);
    expect(1 - (24.9 + 520 / 60) / 45).toBeCloseTo(0.25, 2);
  });
  it("demand twice supply gives Rs 30.07", () => expect(price({ demandQty: 2000 })).toBe(30.07));
  it("supply twice demand gives Rs 22.31", () => expect(price({ supplyQty: 2000 })).toBe(22.31));
  it("a quarter of shelf life left gives Rs 19.72", () => expect(price({ lifeLeft: 0.25 })).toBe(19.72));
  it("a festival rule multiplying demand by 0.6 gives Rs 22.83", () => expect(price({ demandMultiplier: 0.6 })).toBe(22.83));
  it("a tier 1 city with a Rs 48 shop price gives Rs 26.35", () => expect(price({ shop: 48 })).toBe(26.35));
  it("the demand nudge stays at zero until enough requests exist", () => expect(price({ demandQty: 2000, demandRequests: 3 })).toBe(24.9));
});

describe("Case 4: one household, 3 kg, same trip", () => {
  it("has no workable price", () => {
    const r = suggestRate({ ...case1, tripQty: 3 }, S);
    expect(r.ok).toBe(false);
    expect(520 / 3).toBeCloseTo(173.33, 2);
  });
  it("breaks even at 17.3 kg", () => expect(breakEvenQty(520, 45, 15)).toBeCloseTo(17.33, 2));
  it("twelve households sharing one trip (36 kg) work: farmer +49%, each pays 18% less", () => {
    const r = suggestRate({ ...case1, tripQty: 36 }, S);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.price / 15 - 1).toBeCloseTo(0.49, 2);
    expect(1 - (r.price + 520 / 36) / 45).toBeCloseTo(0.18, 2);
  });
});

describe("rate suggestion: 200,000 random tries", () => {
  // Deterministic pseudo-random numbers so a failure can be replayed.
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const randomInputs = (): RateInputs => {
    const mandi = 2 + rnd() * 200;
    return {
      mandi,
      shop: mandi * (1 + rnd() * 4),
      tripCost: rnd() * 3000,
      tripQty: 1 + rnd() * 2000,
      demandQty: rnd() * 5000,
      supplyQty: 1 + rnd() * 5000,
      demandRequests: Math.floor(rnd() * 60),
      demandMultiplier: 0.3 + rnd() * 2,
      lifeLeft: rnd(),
    };
  };

  it("never suggests below the mandi floor or above the shop ceiling", () => {
    let priced = 0;
    for (let n = 0; n < 200_000; n++) {
      const i = randomInputs();
      const r = suggestRate(i, S);
      if (!r.ok) {
        expect(i.shop - i.tripCost / i.tripQty - i.mandi).toBeLessThanOrEqual(0);
        continue;
      }
      priced++;
      expect(r.price).toBeGreaterThanOrEqual(Math.round(i.mandi * 100) / 100 - 0.005);
      expect(r.price).toBeLessThanOrEqual(Math.round((i.shop - i.tripCost / i.tripQty) * 100) / 100 + 0.005);
    }
    expect(priced).toBeGreaterThan(50_000);
  });

  it("moves the right way: more demand, more life left or a dearer shop never lowers the price", () => {
    for (let n = 0; n < 50_000; n++) {
      const i = randomInputs();
      const base = suggestRate(i, S);
      if (!base.ok) continue;
      const more = (j: Partial<RateInputs>) => {
        const r = suggestRate({ ...i, ...j }, S);
        return r.ok ? r.price : Infinity;
      };
      expect(more({ demandQty: i.demandQty * 1.5 + 1 })).toBeGreaterThanOrEqual(base.price - 0.005);
      expect(more({ lifeLeft: Math.min(1, i.lifeLeft + 0.2) })).toBeGreaterThanOrEqual(base.price - 0.005);
      expect(more({ shop: i.shop * 1.2 })).toBeGreaterThanOrEqual(base.price - 0.005);
      const glut = suggestRate({ ...i, supplyQty: i.supplyQty * 2 }, S);
      if (glut.ok) expect(glut.price).toBeLessThanOrEqual(base.price + 0.005);
    }
  });
});
