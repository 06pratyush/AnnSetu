// Steps 2 and 3, hard rules and score. The design doc's checks: "No listing that breaks a hard rule
// is ever shown" and "A farmer with no order history is not pushed to the bottom of the list".
import type { Context } from "z3-solver";
import { describe } from "vitest";
import { checkHardRules, ruleApplies, scoreListing, type AreaRule, type ListingFacts, type MatchRequest } from "@/lib/matching/engine";
import { geoKm } from "@/lib/matching/geo";
import { DEFAULT_SETTINGS, type EngineSettings } from "@/lib/matching/settings";
import { Num, type Dom, type P, type ZBool, type ZNum } from "./dom";
import { docRules, hardRules, RULES, score, trust, type RuleIn, type ScoreIn } from "./models/matching";
import { suite } from "./z3";

const t = suite("matching", "Matching: hard rules and score (steps 2 and 3)");

// ---------------------------------------------------------------- random cases for the checks
let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const NOW = Date.UTC(2026, 9, 5, 6, 0, 0);

function randomCase(): { l: ListingFacts; req: MatchRequest; rules: AreaRule[]; s: EngineSettings } {
  const s = { ...DEFAULT_SETTINGS, requireVerified: rnd() < 0.3 };
  const located = rnd() < 0.9;
  const l: ListingFacts = {
    id: `l${Math.floor(rnd() * 1e9)}`,
    itemId: pick(["tomato", "spinach", "potato"]),
    category: pick(["vegetables", "fruits"]),
    status: rnd() < 0.9 ? "active" : "paused",
    farmerVerified: rnd() < 0.5,
    lat: rnd() < 0.95 ? 26.9 + rnd() : null,
    lng: 75.8 + rnd(),
    radiusKm: 5 + rnd() * 80,
    availableBase: rnd() < 0.05 ? 0 : rnd() * 300,
    minOrderBase: rnd() * 20,
    priceBase: 5 + rnd() * 60,
    harvestedAt: NOW - rnd() * 200 * 3600_000,
    shelfLifeHours: pick([24, 120, 240, 2160]),
    state: "Rajasthan",
    district: pick(["Jaipur", "Ajmer"]),
    ordersCompleted: Math.floor(rnd() * 40),
    ordersOnTime: 0,
    isOrganic: rnd() < 0.3,
  };
  l.ordersOnTime = Math.floor(rnd() * (l.ordersCompleted + 1));
  const req: MatchRequest = {
    itemId: rnd() < 0.8 ? pick(["tomato", "spinach", "potato"]) : null,
    quantity: rnd() < 0.7 ? rnd() * 150 : null,
    lat: located ? 26.9 + rnd() : null,
    lng: located ? 75.8 + rnd() : null,
    buyerType: pick(["individual", "industrial", null]),
    maxKm: rnd() < 0.3 ? 10 + rnd() * 90 : null,
    state: "Rajasthan",
    district: pick(["Jaipur", "Ajmer", null]),
    category: rnd() < 0.2 ? pick(["vegetables", "fruits"]) : null,
    organicOnly: rnd() < 0.2,
    now: NOW,
  };
  const rules: AreaRule[] = rnd() < 0.3 ? [{ state: "Rajasthan", district: pick(["Jaipur", null]), itemId: l.itemId, category: null, startsOn: "2026-10-01", endsOn: pick(["2026-10-04", "2026-10-10"]), action: "hide" }] : [];
  return { l, req, rules, s };
}

function ruleInputs(l: ListingFacts, req: MatchRequest, rules: AreaRule[], s: EngineSettings): RuleIn<number, boolean> {
  const buyerLocated = req.lat !== null && req.lng !== null;
  const farmLocated = l.lat !== null && l.lng !== null;
  return {
    itemMatches: req.itemId === null || l.itemId === req.itemId,
    categoryMatches: !req.category || l.category === req.category,
    organicOk: !req.organicOnly || l.isOrganic,
    active: l.status === "active",
    available: l.availableBase,
    requireVerified: s.requireVerified,
    verified: l.farmerVerified,
    buyerLocated,
    farmLocated,
    km: buyerLocated && farmLocated ? geoKm(req.lat!, req.lng!, l.lat!, l.lng!) : 0,
    maxKm: req.maxKm ?? (req.buyerType === "industrial" ? s.businessMaxKm : s.householdMaxKm),
    radiusKm: l.radiusKm,
    hasQuantity: req.quantity !== null,
    quantity: req.quantity ?? 0,
    minOrder: l.minOrderBase,
    industrial: req.buyerType === "industrial",
    hoursSinceHarvest: (req.now - l.harvestedAt) / 3600_000,
    roadFactor: s.roadFactor,
    speed: s.speedKmph,
    freshnessLimit: s.freshnessLimit,
    shelfLife: l.shelfLifeHours,
    hiddenByAreaRule: rules.some((r) => r.action === "hide" && ruleApplies(r, l, req)),
  };
}

describe("the models are the code", () => {
  t.check("M0a", "The hard-rule model gives the same answer as checkHardRules on 100,000 random cases", () => {
    let mismatches = 0;
    let shown = 0;
    for (let n = 0; n < 100_000; n++) {
      const { l, req, rules, s } = randomCase();
      const code = checkHardRules(l, req, rules, s) ?? "shown";
      const model = RULES[hardRules(Num, ruleInputs(l, req, rules, s))];
      if (code !== model) mismatches++;
      if (code === "shown") shown++;
    }
    return { passed: mismatches === 0, detail: `100,000 random cases (${shown.toLocaleString("en-IN")} shown): ${mismatches} differences, including which rule failed first` };
  });

  t.check("M0b", "The score model gives the same parts and score as scoreListing on 100,000 random cases", () => {
    let mismatches = 0;
    for (let n = 0; n < 100_000; n++) {
      const { l, req, s } = randomCase();
      const shop = rnd() < 0.15 ? null : 10 + rnd() * 80;
      const code = scoreListing(l, req, shop, s);
      const located = req.lat !== null && req.lng !== null && l.lat !== null && l.lng !== null;
      const w = req.buyerType === "industrial" ? s.wBusiness : s.wHousehold;
      const x: ScoreIn<number, boolean> = {
        priceBase: l.priceBase,
        hasShop: Boolean(shop && shop > 0),
        shop: shop ?? 0,
        located,
        km: located ? geoKm(req.lat!, req.lng!, l.lat!, l.lng!) : 0,
        maxKm: req.maxKm ?? (req.buyerType === "industrial" ? s.businessMaxKm : s.householdMaxKm),
        hoursSinceHarvest: (req.now - l.harvestedAt) / 3600_000,
        roadFactor: s.roadFactor,
        speed: s.speedKmph,
        shelfLife: l.shelfLifeHours,
        completed: l.ordersCompleted,
        onTime: l.ordersOnTime,
        priorOnTime: s.trustPriorOnTime,
        priorTotal: s.trustPriorTotal,
        hasQuantity: req.quantity !== null,
        quantity: req.quantity ?? 0,
        available: l.availableBase,
        wPrice: w.price,
        wFresh: w.fresh,
        wNear: w.near,
        wTrust: w.trust,
        wFill: w.fill,
      };
      const m = score(Num, x);
      const same = m.score === code.score && (["price", "fresh", "near", "trust", "fill"] as const).every((k) => m.parts[k] === code.parts[k]);
      if (!same) mismatches++;
    }
    return { passed: mismatches === 0, detail: `100,000 random cases: ${mismatches} differences in any part or the score` };
  });
});

// ---------------------------------------------------------------- symbolic inputs
function ruleVars(Z: Context<P>, tag = ""): RuleIn<ZNum, ZBool> {
  const b = (n: string) => Z.Bool.const(`${tag}${n}`);
  const r = (n: string) => Z.Real.const(`${tag}${n}`);
  return {
    itemMatches: b("itemMatches"),
    categoryMatches: b("categoryMatches"),
    organicOk: b("organicOk"),
    active: b("active"),
    available: r("available"),
    requireVerified: b("requireVerified"),
    verified: b("verified"),
    buyerLocated: b("buyerLocated"),
    farmLocated: b("farmLocated"),
    km: r("km"),
    maxKm: r("maxKm"),
    radiusKm: r("radiusKm"),
    hasQuantity: b("hasQuantity"),
    quantity: r("quantity"),
    minOrder: r("minOrder"),
    industrial: b("industrial"),
    hoursSinceHarvest: r("hoursSinceHarvest"),
    roadFactor: r("roadFactor"),
    speed: r("speed"),
    freshnessLimit: r("freshnessLimit"),
    shelfLife: r("shelfLife"),
    hiddenByAreaRule: b("hidden"),
  };
}
const ruleDomain = (x: RuleIn<ZNum, ZBool>): ZBool[] => [x.km.ge(0), x.roadFactor.gt(0), x.speed.gt(0), x.shelfLife.gt(0), x.freshnessLimit.gt(0), x.freshnessLimit.le(1), x.hoursSinceHarvest.ge(0)];

function scoreVars(Z: Context<P>, tag = ""): ScoreIn<ZNum, ZBool> {
  const b = (n: string) => Z.Bool.const(`${tag}${n}`);
  const r = (n: string) => Z.Real.const(`${tag}${n}`);
  return {
    priceBase: r("priceBase"),
    hasShop: b("hasShop"),
    shop: r("shop"),
    located: b("located"),
    km: r("km"),
    maxKm: r("maxKm"),
    hoursSinceHarvest: r("hoursSinceHarvest"),
    roadFactor: r("roadFactor"),
    speed: r("speed"),
    shelfLife: r("shelfLife"),
    completed: r("completed"),
    onTime: r("onTime"),
    priorOnTime: r("priorOnTime"),
    priorTotal: r("priorTotal"),
    hasQuantity: b("hasQuantity"),
    quantity: r("quantity"),
    available: r("available"),
    wPrice: r("wPrice"),
    wFresh: r("wFresh"),
    wNear: r("wNear"),
    wTrust: r("wTrust"),
    wFill: r("wFill"),
  };
}
/** Facts about any listing that is shown, and the database's checks on settings. */
function scoreDomain(x: ScoreIn<ZNum, ZBool>, opts: { weightsSumToOne?: boolean; priorsValid?: boolean } = {}): ZBool[] {
  const w = [x.wPrice, x.wFresh, x.wNear, x.wTrust, x.wFill];
  return [
    x.priceBase.gt(0),
    x.hasShop.eq(x.hasShop), // either way
    x.shop.gt(0),
    x.km.ge(0),
    x.maxKm.gt(0),
    x.hoursSinceHarvest.ge(0),
    x.roadFactor.gt(0),
    x.speed.gt(0),
    x.shelfLife.gt(0),
    x.completed.ge(0),
    x.onTime.ge(0),
    x.onTime.le(x.completed), // proved to stay true in orders.proof.ts (O4)
    x.priorOnTime.ge(0), // engine_settings checks
    x.priorTotal.gt(0),
    x.quantity.gt(0),
    x.available.gt(0), // shown listings have stock (rule "inactive")
    ...w.map((v) => v.ge(0)),
    ...(opts.weightsSumToOne === false ? [] : [w.reduce((a, b) => a.add(b)).eq(1)]),
    ...(opts.priorsValid === false ? [] : [x.priorOnTime.le(x.priorTotal)]),
  ];
}

describe("hard rules", () => {
  t.theorem(
    "M1",
    "A listing is shown exactly when it keeps every hard rule",
    "For every listing and buyer: checkHardRules lets it through ⇔ same item, active with stock, verified if required, within the buyer's distance and the farm's radius, minimum order met, enough stock for a household, at most the freshness limit of its shelf life used on arrival, and not hidden by an area rule.",
    (Z, D) => {
      const x = ruleVars(Z);
      const shown = hardRules(D, x).eq(0);
      const spec = docRules(D, x);
      return { given: ruleDomain(x), claim: Z.And(Z.Implies(shown, spec), Z.Implies(spec, shown)), watch: { km: x.km, maxKm: x.maxKm } };
    },
  );

  t.theorem(
    "M2",
    "Everything shown arrives with at least 40% of its shelf life left",
    "If a listing is shown, its freshness on arrival 1 − (hours since harvest + travel hours) / shelf life ≥ 1 − freshness limit (= 0.4 by default).",
    (Z, D) => {
      const x = ruleVars(Z);
      const shown = hardRules(D, x).eq(0);
      const travel = D.ite(x.buyerLocated, x.km.mul(x.roadFactor).div(x.speed), D.num(0));
      const lifeLeft = D.num(1).sub(x.hoursSinceHarvest.add(travel).div(x.shelfLife));
      return { given: [...ruleDomain(x), shown], claim: lifeLeft.ge(D.num(1).sub(x.freshnessLimit)), watch: { hours: x.hoursSinceHarvest, km: x.km, shelfLife: x.shelfLife } };
    },
  );
});

describe("score", () => {
  t.theorem(
    "M3a",
    "Each part of the score is between 0 and 1",
    "For any listing that is shown: price, freshness, nearness, trust and fill are each in [0, 1] (trust needs on-time ≤ completed and a prior of at most 100%).",
    (Z, D) => {
      const x = scoreVars(Z);
      const { parts } = score(D, x);
      const all = Object.values(parts).flatMap((v) => [v.ge(0), v.le(1)]);
      return { given: scoreDomain(x), claim: Z.And(...all), watch: { onTime: x.onTime, completed: x.completed } };
    },
  );
  const average = (weightsSumToOne: boolean) => (Z: Context<P>, D: Dom<ZNum, ZBool>) => {
    const w = ["wPrice", "wFresh", "wNear", "wTrust", "wFill"].map((n) => Z.Real.const(n));
    const p = ["price", "fresh", "near", "trust", "fill"].map((n) => Z.Real.const(n));
    const sum = w.map((wi, k) => wi.mul(p[k])).reduce((a, b) => a.add(b));
    const given = [...w.map((v) => v.ge(0)), ...p.flatMap((v) => [v.ge(0), v.le(1)]), ...(weightsSumToOne ? [w.reduce((a, b) => a.add(b)).eq(1)] : [])];
    return { given, claim: Z.And(sum.ge(0), sum.le(1)), watch: { score: sum, ...Object.fromEntries(w.map((v, k) => [["wPrice", "wFresh", "wNear", "wTrust", "wFill"][k], v])) } };
  };
  t.theorem("M3", "Every score is between 0 and 1", "Weights ≥ 0 that add up to 1, and parts in [0, 1] (M3a) ⇒ 0 ≤ score ≤ 1 (shown as 0-100 in the app).", average(true));
  t.theorem(
    "M3-old",
    "Finding: the settings table allowed weights that push scores past 100",
    "M3 without the weights adding up to 1, which engine_settings did not check.",
    average(false),
    { expect: "counterexample", note: "Fixed: engine_settings now checks that each weight set is non-negative and adds up to 1, and that the trust prior's on-time count is at most its total." },
  );
  t.check("M3-code", "The M3 finding, reproduced on the shipped scoreListing", () => {
    const { l, req } = randomCase();
    const s = { ...DEFAULT_SETTINGS, wHousehold: { price: 1, fresh: 1, near: 1, trust: 1, fill: 0 }, wBusiness: { price: 1, fresh: 1, near: 1, trust: 1, fill: 1 } };
    const shown = { ...l, priceBase: 10, harvestedAt: NOW, ordersCompleted: 10, ordersOnTime: 10, availableBase: 100 };
    const r = scoreListing(shown, { ...req, quantity: 10 }, 45, s);
    return { passed: r.score > 1, detail: `weights 1 + 1 + 1 + 1 (+ 1) give a score of ${(r.score * 100).toFixed(0)} "of 100"` };
  });

  const better = (field: keyof ScoreIn<ZNum, ZBool>, direction: "lower" | "higher", extra: (a: ScoreIn<ZNum, ZBool>) => ZBool[] = () => []) => (Z: Context<P>, D: Dom<ZNum, ZBool>) => {
    const a = scoreVars(Z);
    const v = Z.Real.const(`${field}′`);
    const b = { ...a, [field]: v } as ScoreIn<ZNum, ZBool>;
    const sa = score(D, a);
    const sb = score(D, b);
    const moved = direction === "lower" ? v.le(a[field] as ZNum) : v.ge(a[field] as ZNum);
    return { given: [...scoreDomain(a), ...scoreDomain(b), moved, ...extra(a)], claim: sb.raw.ge(sa.raw), watch: { before: sa.raw, after: sb.raw } };
  };
  t.theorem("M4a", "A cheaper listing never scores lower", "All else equal: price′ ≤ price ⇒ score′ ≥ score.", better("priceBase", "lower"));
  t.theorem("M4b", "A fresher listing never scores lower", "All else equal: hours since harvest′ ≤ hours since harvest ⇒ score′ ≥ score.", better("hoursSinceHarvest", "lower"));
  t.theorem("M4c", "A nearer farm never scores lower", "All else equal: km′ ≤ km ⇒ score′ ≥ score (nearness and freshness on arrival both improve).", better("km", "lower"));
  t.theorem("M4d", "A more reliable farmer never scores lower", "All else equal (same completed orders): on-time′ ≥ on-time ⇒ score′ ≥ score.", better("onTime", "higher"));
  t.theorem("M4e", "More stock never scores lower", "All else equal: available′ ≥ available ⇒ score′ ≥ score (the fill part).", better("available", "higher"));
  t.theorem(
    "M4f",
    "Lemma: rounding the score to 9 decimals keeps order",
    "x ≤ y ⇒ round(10⁹x) ≤ round(10⁹y), so M4a–e hold for the rounded score the list is sorted by.",
    (Z, D) => {
      const [x, y] = ["x", "y"].map((n) => Z.Real.const(n));
      return { given: [x.le(y)], claim: D.round(x.mul(1e9)).le(D.round(y.mul(1e9))), watch: { x, y } };
    },
  );
});

describe("new farmers", () => {
  t.theorem(
    "M5",
    "A new farmer is not pushed to the bottom",
    "A farmer with no orders has trust = prior on-time / prior total (8/10 = 0.8). It is at least the trust of any farmer whose on-time rate is at most that (on-time / completed ≤ 0.8), with equality only at the same rate, so with everything else equal a new farmer ranks at or above every farmer delivering on time 80% of the time or less.",
    (Z, D) => {
      const [c, o, po, pt] = ["completed", "onTime", "priorOnTime", "priorTotal"].map((n) => Z.Real.const(n));
      const fresh = trust(D, D.num(0), D.num(0), po, pt);
      const other = trust(D, c, o, po, pt);
      const rateAtMostPrior = o.mul(pt).le(c.mul(po));
      return { given: [c.gt(0), o.ge(0), o.le(c), po.ge(0), po.le(pt), pt.gt(0)], claim: Z.And(Z.Implies(rateAtMostPrior, fresh.ge(other)), Z.Implies(fresh.ge(other), rateAtMostPrior)), watch: { completed: c, onTime: o } };
    },
  );

  t.theorem(
    "M6",
    "Trust moves the right way",
    "One more on-time delivery never lowers trust; one more late delivery (or a cancellation by the farmer) never raises it.",
    (Z, D) => {
      const [c, o, po, pt] = ["completed", "onTime", "priorOnTime", "priorTotal"].map((n) => Z.Real.const(n));
      const now = trust(D, c, o, po, pt);
      const onTime = trust(D, c.add(1), o.add(1), po, pt);
      const late = trust(D, c.add(1), o, po, pt);
      return { given: [c.ge(0), o.ge(0), o.le(c), po.ge(0), po.le(pt), pt.gt(0)], claim: Z.And(onTime.ge(now), late.le(now)), watch: { completed: c, onTime: o } };
    },
  );
});
