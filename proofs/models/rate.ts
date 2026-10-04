// Step 5, the rate rule (src/lib/matching/rate.ts), line for line. "shipped" is the version
// deployed at commit 724c56c; "current" is the code now in the repository.
import type { Dom } from "../dom";

export interface RateIn<N> {
  mandi: N;
  shop: N;
  tripCost: N;
  tripQty: N;
  demandQty: N;
  supplyQty: N;
  demandRequests: N;
  demandMultiplier: N;
  lifeLeft: N;
}
export interface RateSettings<N> {
  farmerShare: N;
  nudgeCap: N;
  nudgeMinRequests: N;
  lotCutPer100: N;
  lotCutMax: N;
}
export const RATE_IN = ["mandi", "shop", "tripCost", "tripQty", "demandQty", "supplyQty", "demandRequests", "demandMultiplier", "lifeLeft"] as const;
export const RATE_SET = ["farmerShare", "nudgeCap", "nudgeMinRequests", "lotCutPer100", "lotCutMax"] as const;

export type Version = "shipped" | "current";

/** Everything before the last step: the price after the split, nudge, ageing and big-lot cut. */
export function preClamp<N, B>(D: Dom<N, B>, i: RateIn<N>, s: RateSettings<N>) {
  const lowest = i.mandi;
  const deliveryPerUnit = D.div(i.tripCost, i.tripQty); // the app's tripQty is at least 1
  const highest = D.sub(i.shop, deliveryPerUnit);
  const room = D.sub(highest, lowest);
  let price = D.add(lowest, D.mul(s.farmerShare, room));
  const cap = D.mul(s.nudgeCap, room);
  const active = D.and(D.ge(i.demandRequests, s.nudgeMinRequests), D.gt(i.supplyQty, D.num(0)));
  const raw = D.mul(D.sub(D.div(D.mul(i.demandQty, i.demandMultiplier), i.supplyQty), D.num(1)), cap);
  const nudge = D.ite(active, D.max(D.neg(cap), D.min(cap, raw)), D.num(0));
  price = D.add(price, nudge);
  const factor = D.ite(D.lt(i.lifeLeft, D.num(0.5)), D.div(D.max(D.num(0), i.lifeLeft), D.num(0.5)), D.num(1));
  price = D.add(lowest, D.mul(D.sub(price, lowest), factor));
  const cut = D.min(s.lotCutMax, D.div(D.mul(s.lotCutPer100, i.tripQty), D.num(100)));
  price = D.mul(price, D.sub(D.num(1), cut));
  return { lowest, highest, room, deliveryPerUnit, price, active, factor, cut };
}

/**
 * The last step: from any price P to the suggestion, given the band [lowest, highest]. Worked in
 * paise so every rounded value is an integer; the app divides the same integer by 100, so the
 * rupee price is `paise / 100` exactly.
 */
export function finalize<N, B>(D: Dom<N, B>, version: Version, P: N, lowest: N, highest: N, room: N) {
  const c100 = D.num(100);
  if (version === "shipped") {
    // Clamp to [lowest, highest] first, then round: Math.round(min(highest, max(lowest, P)) * 100) / 100.
    const paise = D.round(D.mul(D.min(highest, D.max(lowest, P)), c100));
    return { ok: D.gt(room, D.num(0)), paise, price: D.div(paise, c100), L: paise, H: paise, R: paise };
  }
  // Whole paise inside the band: L = ⌈100·lowest⌉ (never below the mandi), H = ⌊100·highest⌋ (never
  // above shop − delivery), R = the rounded price; the suggestion is R clamped to [L, H].
  const L = D.ceil(D.sub(D.mul(lowest, c100), D.num("0.000001")));
  const H = D.floor(D.mul(highest, c100));
  const R = D.round(D.mul(P, c100));
  const paise = D.min(H, D.max(L, R));
  return { ok: D.and(D.gt(room, D.num(0)), D.ge(H, L)), paise, price: D.div(paise, c100), L, H, R };
}

export function rateModel<N, B>(D: Dom<N, B>, i: RateIn<N>, s: RateSettings<N>, version: Version) {
  const pre = preClamp(D, i, s);
  const fin = finalize(D, version, pre.price, pre.lowest, pre.highest, pre.room);
  return { ...pre, ...fin, preClampPrice: pre.price };
}
