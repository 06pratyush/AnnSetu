// Steps 2 and 3 (src/lib/matching/engine.ts), line for line: the hard rules and the score.
// Distances come in as km (the haversine formula itself is not part of these proofs) and
// "now − harvested" as hours.
import type { Dom } from "../dom";

/** Codes in checkHardRules order; 0 means the listing may be shown. */
export const RULES = ["shown", "item", "inactive", "unverified", "no_location", "too_far", "below_min_order", "not_enough_stock", "not_fresh_on_arrival", "hidden_in_area"] as const;
export type RuleCode = (typeof RULES)[number];

export interface RuleIn<N, B> {
  itemMatches: B; // req.itemId === null || l.itemId === req.itemId
  categoryMatches: B; // !req.category || l.category === req.category
  organicOk: B; // !req.organicOnly || l.isOrganic
  active: B; // l.status === "active"
  available: N; // l.availableBase
  requireVerified: B;
  verified: B;
  buyerLocated: B;
  farmLocated: B;
  km: N; // geoKm(buyer, farm) when both are located
  maxKm: N; // maxKmFor(req)
  radiusKm: N;
  hasQuantity: B;
  quantity: N;
  minOrder: N;
  industrial: B;
  hoursSinceHarvest: N; // (now − harvestedAt) / 3,600,000
  roadFactor: N;
  speed: N;
  freshnessLimit: N;
  shelfLife: N;
  hiddenByAreaRule: B; // rules.some(hide && ruleApplies)
}

/** checkHardRules: the first rule a listing breaks, as an index into RULES (0 = shown). */
export function hardRules<N, B>(D: Dom<N, B>, x: RuleIn<N, B>): N {
  const code = (c: RuleCode) => D.num(RULES.indexOf(c));
  const km = D.ite(x.buyerLocated, x.km, D.num(0));
  const hoursUsed = D.add(x.hoursSinceHarvest, D.div(D.mul(km, x.roadFactor), x.speed));
  return D.ite(
    D.not(x.itemMatches),
    code("item"),
    D.ite(
      D.not(x.categoryMatches),
      code("item"),
      D.ite(
        D.not(x.organicOk),
        code("item"),
        D.ite(
          D.or(D.not(x.active), D.le(x.available, D.num(0))),
          code("inactive"),
          D.ite(
            D.and(x.requireVerified, D.not(x.verified)),
            code("unverified"),
            D.ite(
              D.and(x.buyerLocated, D.not(x.farmLocated)),
              code("no_location"),
              D.ite(
                D.and(x.buyerLocated, D.or(D.gt(x.km, x.maxKm), D.gt(x.km, x.radiusKm))),
                code("too_far"),
                D.ite(
                  D.and(x.hasQuantity, D.lt(x.quantity, x.minOrder)),
                  code("below_min_order"),
                  D.ite(
                    D.and(x.hasQuantity, D.not(x.industrial), D.lt(x.available, x.quantity)),
                    code("not_enough_stock"),
                    D.ite(D.gt(hoursUsed, D.mul(x.freshnessLimit, x.shelfLife)), code("not_fresh_on_arrival"), D.ite(x.hiddenByAreaRule, code("hidden_in_area"), code("shown"))),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/** The design doc's rules, written as one statement, independently of the code above. */
export function docRules<N, B>(D: Dom<N, B>, x: RuleIn<N, B>): B {
  const travel = D.ite(x.buyerLocated, D.div(D.mul(x.km, x.roadFactor), x.speed), D.num(0));
  return D.and(
    x.itemMatches,
    x.categoryMatches,
    x.organicOk,
    x.active,
    D.gt(x.available, D.num(0)),
    D.implies(x.requireVerified, x.verified),
    D.implies(x.buyerLocated, D.and(x.farmLocated, D.le(x.km, x.maxKm), D.le(x.km, x.radiusKm))),
    D.implies(x.hasQuantity, D.and(D.ge(x.quantity, x.minOrder), D.or(x.industrial, D.ge(x.available, x.quantity)))),
    D.le(D.add(x.hoursSinceHarvest, travel), D.mul(x.freshnessLimit, x.shelfLife)),
    D.not(x.hiddenByAreaRule),
  );
}

export interface ScoreIn<N, B> {
  priceBase: N;
  hasShop: B; // shopPrice && shopPrice > 0
  shop: N;
  located: B; // buyer and farm both located
  km: N;
  maxKm: N;
  hoursSinceHarvest: N;
  roadFactor: N;
  speed: N;
  shelfLife: N;
  completed: N;
  onTime: N;
  priorOnTime: N;
  priorTotal: N;
  hasQuantity: B;
  quantity: N;
  available: N;
  wPrice: N;
  wFresh: N;
  wNear: N;
  wTrust: N;
  wFill: N;
}

const clamp01 = <N, B>(D: Dom<N, B>, x: N) => D.min(D.num(1), D.max(D.num(0), x));

export function trust<N, B>(D: Dom<N, B>, completed: N, onTime: N, priorOnTime: N, priorTotal: N): N {
  return D.div(D.add(onTime, priorOnTime), D.add(completed, priorTotal));
}

/** scoreListing: the five parts and the weighted score, rounded to 9 decimals like the code. */
export function score<N, B>(D: Dom<N, B>, x: ScoreIn<N, B>) {
  const tHours = D.ite(x.located, D.div(D.mul(x.km, x.roadFactor), x.speed), D.num(0));
  const hoursUsed = D.add(x.hoursSinceHarvest, tHours);
  const parts = {
    price: D.ite(x.hasShop, clamp01(D, D.sub(D.num(1.5), D.div(x.priceBase, x.shop))), D.num(0.5)),
    fresh: clamp01(D, D.sub(D.num(1), D.div(hoursUsed, x.shelfLife))),
    near: D.ite(x.located, clamp01(D, D.sub(D.num(1), D.div(x.km, x.maxKm))), D.num(0.5)),
    trust: trust(D, x.completed, x.onTime, x.priorOnTime, x.priorTotal),
    fill: D.ite(x.hasQuantity, D.min(D.num(1), D.div(x.available, x.quantity)), D.num(1)),
  };
  const raw = D.add(
    D.add(D.add(D.add(D.mul(x.wPrice, parts.price), D.mul(x.wFresh, parts.fresh)), D.mul(x.wNear, parts.near)), D.mul(x.wTrust, parts.trust)),
    D.mul(x.wFill, parts.fill),
  );
  return { parts, raw, score: D.div(D.round(D.mul(raw, D.num(1e9))), D.num(1e9)), hoursUsed };
}
