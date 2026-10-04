// Step 5, the suggested rate. The design doc's check: "a suggested rate is never below what the
// mandi pays the farmer and never above what the shop charges the buyer".
// Amounts are compared in paise (×100) so rounding stays in whole numbers; that is the same claim.
import type { Context } from "z3-solver";
import { describe } from "vitest";
import { suggestRate, type RateInputs } from "@/lib/matching/rate";
import { DEFAULT_SETTINGS } from "@/lib/matching/settings";
import { Num, type Dom, type P, type ZBool, type ZNum } from "./dom";
import { finalize, preClamp, rateModel, RATE_IN, RATE_SET, type RateIn, type RateSettings } from "./models/rate";
import { reals, suite } from "./z3";

const t = suite("rate", "Suggested rate (step 5)");

/** What the database and the app guarantee about the inputs. */
function domain(i: RateIn<ZNum>, s: RateSettings<ZNum>): ZBool[] {
  return [
    i.mandi.gt(0), // reference_prices: mandi_price > 0
    i.shop.gt(0),
    i.tripCost.gt(0),
    i.tripQty.ge(1), // the form's load is at least 1 unit
    i.demandQty.ge(0),
    i.supplyQty.ge(0),
    i.demandRequests.ge(0),
    i.demandMultiplier.gt(0), // area_rules: demand_multiplier > 0
    i.lifeLeft.ge(0),
    i.lifeLeft.le(1),
    // engine_settings column checks
    s.farmerShare.ge(0),
    s.farmerShare.le(1),
    s.nudgeCap.ge(0),
    s.nudgeCap.le(1),
    s.nudgeMinRequests.ge(0),
    s.lotCutPer100.ge(0),
    s.lotCutMax.ge(0),
    s.lotCutMax.le(0.5),
  ];
}
/** x is a whole number of paise (prices are stored as numeric(12,2)). */
const wholePaise = (D: Dom<ZNum, ZBool>, x: ZNum) => x.mul(100).eq(D.floor(x.mul(100)));

/** The last step on its own: mandi m, shop s, delivery per unit d, and any price P from the earlier steps. */
function lastStep(Z: Context<P>, D: Dom<ZNum, ZBool>, version: "current" | "shipped") {
  const [m, s, d, p] = ["m", "s", "d", "P"].map((n) => Z.Real.const(n));
  const f = finalize(D, version, p, m, s.sub(d), s.sub(d).sub(m));
  return { m, s, d, p, f, watch: { mandi: m, shop: s, deliveryPerUnit: d, priceBeforeLastStep: p, suggestedPaise: f.paise } };
}

describe("the model is the code", () => {
  t.check("R0", "The rate model gives the same answer as suggestRate on 100,000 random cases", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const paise = (x: number) => Math.round(x * 100) / 100;
    let mismatches = 0;
    let priced = 0;
    for (let n = 0; n < 100_000; n++) {
      const mandi = paise(1 + rnd() * 300);
      const i: RateInputs = {
        mandi,
        shop: paise(mandi * (0.8 + rnd() * 4)),
        tripCost: paise(rnd() * 4000),
        tripQty: 1 + rnd() * 3000,
        demandQty: rnd() < 0.2 ? 0 : rnd() * 8000,
        supplyQty: rnd() < 0.1 ? 0 : rnd() * 8000,
        demandRequests: Math.floor(rnd() * 50),
        demandMultiplier: 0.3 + rnd() * 2,
        lifeLeft: rnd() < 0.1 ? 1 : rnd(),
      };
      const code = suggestRate(i, DEFAULT_SETTINGS);
      const model = rateModel(Num, i, DEFAULT_SETTINGS, "current");
      if (code.ok !== model.ok || (code.ok && code.price !== model.price)) mismatches++;
      if (code.ok) priced++;
    }
    return { passed: mismatches === 0, detail: `100,000 random cases (${priced.toLocaleString("en-IN")} with a price): ${mismatches} differences` };
  });
});

describe("the band", () => {
  t.theorem(
    "R1",
    "The suggested rate is never below the mandi price",
    "For every mandi price m (whole paise), shop price s, delivery cost per unit d ≥ 0, and every price P the earlier steps could produce: if a rate is suggested, then rate ≥ m.",
    (Z, D) => {
      const { m, s, d, f, watch } = lastStep(Z, D, "current");
      return { given: [m.gt(0), s.gt(0), d.ge(0), wholePaise(D, m), f.ok], claim: f.paise.ge(m.mul(100)), watch };
    },
  );

  t.theorem(
    "R2",
    "The buyer never pays more than the shop, delivery included",
    "For every m > 0, s, d ≥ 0 and every P: if a rate is suggested, then rate + d ≤ s.",
    (Z, D) => {
      const { m, s, d, f, watch } = lastStep(Z, D, "current");
      return { given: [m.gt(0), s.gt(0), d.ge(0), f.ok], claim: f.paise.add(d.mul(100)).le(s.mul(100)), watch };
    },
  );

  t.theorem(
    "R2-old",
    "Finding: the deployed rule could suggest a rate above that ceiling",
    "R2 for the version deployed at commit 724c56c, which clamped first and rounded second (prices in whole paise).",
    (Z, D) => {
      const { m, s, d, f, watch } = lastStep(Z, D, "shipped");
      return { given: [m.gt(0), s.gt(0), d.ge(0), wholePaise(D, m), wholePaise(D, s), f.ok], claim: f.paise.add(d.mul(100)).le(s.mul(100)), watch };
    },
    { expect: "counterexample", note: "Fixed in src/lib/matching/rate.ts: the band is rounded inwards to whole paise before clamping." },
  );

  t.theorem(
    "R3",
    "The suggested rate is a whole number of paise",
    "If a rate is suggested, 100 × rate is one of ⌈100m⌉, ⌊100(s − d)⌋ or round(100P): always an integer.",
    (Z, D) => {
      const { m, s, d, f, watch } = lastStep(Z, D, "current");
      return { given: [m.gt(0), s.gt(0), d.ge(0), f.ok], claim: Z.Or(f.paise.eq(f.L), f.paise.eq(f.H), f.paise.eq(f.R)), watch };
    },
  );
});

describe("break-even", () => {
  t.theorem(
    "R4",
    "There is room for a price exactly when the load passes the break-even weight",
    "For trip cost T > 0 and load q > 0: if s > m, then (s − T/q) − m > 0 ⇔ q > T / (s − m); if s ≤ m, there is never room.",
    (Z) => {
      const [m, s, T, q] = ["m", "s", "T", "q"].map((n) => Z.Real.const(n));
      const room = s.sub(T.div(q)).sub(m);
      const breakEven = T.div(s.sub(m));
      const iff = Z.And(Z.Implies(room.gt(0), q.gt(breakEven)), Z.Implies(q.gt(breakEven), room.gt(0)));
      const claim = Z.And(Z.Implies(s.gt(m), iff), Z.Implies(s.le(m), room.le(0)));
      return { given: [m.gt(0), s.gt(0), T.gt(0), q.gt(0)], claim, watch: { m, s, T, q } };
    },
  );

  t.theorem(
    "R5",
    "A load one paisa past break-even always gets a suggestion",
    "For whole-paise m and s: if the delivery cost per unit d ≤ s − m − 0.01 (that is, q ≥ T / (s − m − 0.01)), a rate is suggested, whatever P is.",
    (Z, D) => {
      const { m, s, d, f, watch } = lastStep(Z, D, "current");
      return { given: [m.gt(0), s.gt(0), d.ge(0), wholePaise(D, m), wholePaise(D, s), d.le(s.sub(m).sub(0.01))], claim: f.ok, watch };
    },
  );
});

describe("moving the right way", () => {
  // The last step is clamp(R(P), L(m), H(h)) with L = ⌈100m − 0.000001⌉, H = ⌊100h⌋, R = round(100P).
  // Each part keeps order (R6a–c) and so does the clamp (R6d); together: final(P, m, h) ≤ final(P′, m′, h′)
  // whenever P ≤ P′, m ≤ m′, h ≤ h′.
  const part = (key: "L" | "H" | "R", title: string, statement: string) =>
    t.theorem(`R6${{ L: "a", H: "b", R: "c" }[key]}`, title, statement, (Z, D) => {
      const [x1, x2] = ["x", "x2"].map((n) => Z.Real.const(n));
      const a = finalize(D, "current", x1, x1, x1, Z.Real.val(1));
      const b = finalize(D, "current", x2, x2, x2, Z.Real.val(1));
      return { given: [x1.le(x2)], claim: a[key].le(b[key]), watch: { x: x1, x2 } };
    });
  part("L", "Lemma: the paise floor keeps order", "m ≤ m′ ⇒ ⌈100m − 0.000001⌉ ≤ ⌈100m′ − 0.000001⌉.");
  part("H", "Lemma: the paise ceiling keeps order", "h ≤ h′ ⇒ ⌊100h⌋ ≤ ⌊100h′⌋.");
  part("R", "Lemma: rounding to paise keeps order", "P ≤ P′ ⇒ round(100P) ≤ round(100P′).");
  t.theorem(
    "R6d",
    "Lemma: clamping keeps order",
    "L ≤ L′, H ≤ H′ and R ≤ R′ ⇒ min(H, max(L, R)) ≤ min(H′, max(L′, R′)). With R6a–c: the last step keeps order.",
    (Z, D) => {
      const [l1, l2, h1, h2, r1, r2] = ["L", "L2", "H", "H2", "R", "R2"].map((n) => Z.Real.const(n));
      return { given: [l1.le(l2), h1.le(h2), r1.le(r2)], claim: D.min(h1, D.max(l1, r1)).le(D.min(h2, D.max(l2, r2))), watch: { L: l1, L2: l2, H: h1, H2: h2, R: r1, R2: r2 } };
    },
  );

  // When the earlier steps land outside the band, the clamp decides on its own:
  t.theorem(
    "R6e",
    "Lemma: a price at or below the mandi becomes exactly the mandi price",
    "For whole-paise m: if P ≤ m and a rate is suggested, then rate = m.",
    (Z, D) => {
      const { m, s, d, p, f, watch } = lastStep(Z, D, "current");
      return { given: [m.gt(0), s.gt(0), d.ge(0), wholePaise(D, m), p.le(m), f.ok], claim: f.paise.eq(m.mul(100)), watch };
    },
  );
  t.theorem(
    "R6f",
    "Lemma: a price at or above the ceiling becomes exactly the ceiling",
    "If P ≥ h then round(100P) ≥ ⌊100h⌋; and when L ≤ H ≤ R, min(H, max(L, R)) = H. So with a suggestion, rate = ⌊100h⌋ / 100.",
    (Z, D) => {
      const [p, h, l] = ["P", "h", "L"].map((n) => Z.Real.const(n));
      const f = finalize(D, "current", p, l, h, Z.Real.val(1));
      const rAboveH = Z.Implies(p.ge(h), f.R.ge(f.H));
      const [L, H, R] = ["L0", "H0", "R0"].map((n) => Z.Real.const(n));
      const clampToH = Z.Implies(Z.And(L.le(H), H.le(R)), D.min(H, D.max(L, R)).eq(H));
      return { given: [], claim: Z.And(rAboveH, clampToH), watch: { P: p, h } };
    },
  );

  /**
   * Two runs that differ in one input. The final rate keeps order when the price before the last
   * step rises (R6a–d), or when both prices sit at or below their mandi floor (R6e, the floor can
   * only rise), or both at or above their ceiling (R6f, the ceiling can only rise).
   */
  const lemma = (field: keyof RateIn<ZNum>, extra: (s: RateSettings<ZNum>) => ZBool[]) => (Z: Context<P>, D: Dom<ZNum, ZBool>) => {
    const i = reals(Z, "i.", RATE_IN) as RateIn<ZNum>;
    const s = reals(Z, "s.", RATE_SET) as RateSettings<ZNum>;
    const changed = Z.Real.const(`${field}′`);
    const i2 = { ...i, [field]: changed };
    const a = preClamp(D, i, s);
    const b = preClamp(D, i2, s);
    const keepsOrder = Z.Or(b.price.ge(a.price), Z.And(a.price.le(a.lowest), b.price.le(b.lowest)), Z.And(a.price.ge(a.highest), b.price.ge(b.highest)));
    return {
      given: [...domain(i, s), ...domain(i2, s), changed.ge(i[field]), a.room.gt(0), b.room.gt(0), ...extra(s)],
      claim: keepsOrder,
      watch: { [field]: i[field], [`${field}′`]: changed, farmerShare: s.farmerShare, nudgeCap: s.nudgeCap, lotCutMax: s.lotCutMax, priceBefore: a.price, priceAfter: b.price, floorBefore: a.lowest, floorAfter: b.lowest, ceilingBefore: a.highest, ceilingAfter: b.highest },
    };
  };
  const shareRule = (s: RateSettings<ZNum>): ZBool[] => [s.nudgeCap.add(s.farmerShare).le(1)];

  t.theorem("R7", "More demand never lowers the suggested rate", "All else equal: demandQty′ ≥ demandQty ⇒ rate′ ≥ rate, for every setting the database allows (with R6a–f).", lemma("demandQty", () => []));
  t.theorem("R8", "Fresher produce never gets a lower rate", "All else equal: lifeLeft′ ≥ lifeLeft ⇒ rate′ ≥ rate, for every setting the database allows (with R6a–f).", lemma("lifeLeft", () => []));
  t.theorem("R9", "A dearer shop never lowers the suggested rate", "All else equal: s′ ≥ s ⇒ rate′ ≥ rate, for every setting the database allows (with R6a–f).", lemma("shop", () => []));
  t.theorem("R10", "A higher mandi price never lowers the suggested rate", "All else equal: m′ ≥ m ⇒ rate′ ≥ rate when both have a suggestion, given farmer share + nudge cap ≤ 1 (with R6a–f).", lemma("mandi", shareRule));

  t.theorem(
    "R10-old",
    "Finding: some allowed settings let a higher mandi price lower the rate",
    "R10 without the condition farmer share + nudge cap ≤ 1, which engine_settings did not enforce.",
    lemma("mandi", () => []),
    { expect: "counterexample", note: "Fixed: engine_settings now checks farmer_share + nudge_cap ≤ 1. The defaults (0.5 + 0.25) always met it." },
  );
  t.check("R10-code", "The R10 finding, reproduced on the shipped suggestRate", () => {
    // Farmer share 1, nudge cap 0.5 and a 50% big-lot cut: each allowed by the old column checks.
    const settings = { ...DEFAULT_SETTINGS, farmerShare: 1, nudgeCap: 0.5, lotCutPer100: 0.05, lotCutMax: 0.5 };
    const base = { shop: 20.1, tripCost: 100, tripQty: 1000, demandQty: 900, supplyQty: 300, demandRequests: 30, demandMultiplier: 1, lifeLeft: 1 };
    const low = suggestRate({ ...base, mandi: 10 }, settings);
    const high = suggestRate({ ...base, mandi: 12 }, settings);
    const fell = low.ok && high.ok && high.price < low.price;
    return {
      passed: fell,
      detail: `mandi ₹10 → suggested ₹${low.ok ? low.price : "-"}; mandi ₹12 → suggested ₹${high.ok ? high.price : "-"} (shop ₹20.10, trip ₹100 for 1,000 kg)`,
    };
  });
});
