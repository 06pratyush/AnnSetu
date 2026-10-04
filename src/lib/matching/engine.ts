// Steps 2 and 3, hard rules and score: the reference implementation. public.match_listings in SQL
// does the same work inside the database; the tests check that both give the same answer.
import { geoKm, travelHours, tripCost } from "./geo";
import type { EngineSettings, Weights } from "./settings";

export type BuyerType = "individual" | "industrial";

export interface ListingFacts {
  id: string;
  itemId: string;
  category: string;
  status: string;
  farmerVerified: boolean;
  lat: number | null;
  lng: number | null;
  /** km the farmer delivers for this listing (already defaulted). */
  radiusKm: number;
  /** In the item's base unit (kg, litre, piece). */
  availableBase: number;
  minOrderBase: number;
  priceBase: number;
  harvestedAt: number; // ms
  shelfLifeHours: number;
  /** The listing's own area, used for prices when the buyer's area is unknown. */
  state: string | null;
  district: string | null;
  ordersCompleted: number;
  ordersOnTime: number;
  isOrganic: boolean;
}

export interface MatchRequest {
  itemId: string | null;
  /** In the item's base unit; null when browsing without a quantity. */
  quantity: number | null;
  lat: number | null;
  lng: number | null;
  buyerType: BuyerType | null;
  /** Farthest distance the buyer accepts; null = default for the buyer type. */
  maxKm: number | null;
  state: string | null;
  district: string | null;
  category?: string | null;
  organicOnly?: boolean;
  now: number; // ms
}

export interface AreaRule {
  state: string | null;
  district: string | null;
  itemId: string | null;
  category: string | null;
  startsOn: string; // yyyy-mm-dd
  endsOn: string;
  action: "hide" | "demand";
  demandMultiplier?: number | null;
}

export type RuleFailure =
  | "item"
  | "inactive"
  | "unverified"
  | "too_far"
  | "below_min_order"
  | "not_enough_stock"
  | "not_fresh_on_arrival"
  | "hidden_in_area"
  | "no_location";

export interface Parts {
  price: number;
  fresh: number;
  near: number;
  trust: number;
  fill: number;
}

export interface Match {
  listing: ListingFacts;
  distanceKm: number | null;
  travelHours: number;
  hoursUsed: number;
  tripCost: number | null;
  parts: Parts;
  score: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Scores are compared at 9 decimals so the SQL and TypeScript orders agree exactly. */
export const round9 = (x: number) => Math.round(x * 1e9) / 1e9;

export function maxKmFor(req: Pick<MatchRequest, "maxKm" | "buyerType">, s: EngineSettings): number {
  return req.maxKm ?? (req.buyerType === "industrial" ? s.businessMaxKm : s.householdMaxKm);
}

export function weightsFor(buyerType: BuyerType | null, s: EngineSettings): Weights {
  return buyerType === "industrial" ? s.wBusiness : s.wHousehold;
}

/** Trust with a prior of imaginary past orders: new farmers start at 8/10 = 0.80. */
export function trustScore(completed: number, onTime: number, s: Pick<EngineSettings, "trustPriorOnTime" | "trustPriorTotal">): number {
  return (onTime + s.trustPriorOnTime) / (completed + s.trustPriorTotal);
}

const today = (now: number) => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10); // date in India

export function ruleApplies(r: AreaRule, l: Pick<ListingFacts, "itemId" | "category">, req: Pick<MatchRequest, "state" | "district" | "now">): boolean {
  const day = today(req.now);
  const lower = (x: string | null) => (x ?? "").toLowerCase();
  return (
    (r.state === null || lower(r.state) === lower(req.state)) &&
    (r.district === null || lower(r.district) === lower(req.district)) &&
    (r.itemId === l.itemId || (r.itemId === null && r.category === l.category)) &&
    r.startsOn <= day &&
    day <= r.endsOn
  );
}

/** Step 2. Returns the first rule the listing breaks for this buyer, or null if it may be shown. */
export function checkHardRules(l: ListingFacts, req: MatchRequest, rules: AreaRule[], s: EngineSettings): RuleFailure | null {
  if (req.itemId !== null && l.itemId !== req.itemId) return "item";
  if (req.category && l.category !== req.category) return "item";
  if (req.organicOnly && !l.isOrganic) return "item";
  if (l.status !== "active" || l.availableBase <= 0) return "inactive";
  if (s.requireVerified && !l.farmerVerified) return "unverified";
  const located = req.lat !== null && req.lng !== null;
  let km = 0;
  if (located) {
    if (l.lat === null || l.lng === null) return "no_location";
    km = geoKm(req.lat!, req.lng!, l.lat, l.lng);
    if (km > maxKmFor(req, s) || km > l.radiusKm) return "too_far";
  }
  if (req.quantity !== null) {
    if (req.quantity < l.minOrderBase) return "below_min_order";
    if (req.buyerType !== "industrial" && l.availableBase < req.quantity) return "not_enough_stock";
  }
  const hoursUsed = (req.now - l.harvestedAt) / 3600_000 + travelHours(km, s);
  if (hoursUsed > s.freshnessLimit * l.shelfLifeHours) return "not_fresh_on_arrival";
  if (rules.some((r) => r.action === "hide" && ruleApplies(r, l, req))) return "hidden_in_area";
  return null;
}

/** Step 3. Score in [0, 1]: price, freshness, nearness, trust and (for businesses) how much of the order it fills. */
export function scoreListing(l: ListingFacts, req: MatchRequest, shopPrice: number | null, s: EngineSettings): Match {
  const located = req.lat !== null && req.lng !== null && l.lat !== null && l.lng !== null;
  const km = located ? geoKm(req.lat!, req.lng!, l.lat!, l.lng!) : null;
  const tHours = km === null ? 0 : travelHours(km, s);
  const hoursUsed = (req.now - l.harvestedAt) / 3600_000 + tHours;
  const parts: Parts = {
    price: shopPrice && shopPrice > 0 ? clamp01(1.5 - l.priceBase / shopPrice) : 0.5,
    fresh: clamp01(1 - hoursUsed / l.shelfLifeHours),
    near: km === null ? 0.5 : clamp01(1 - km / maxKmFor(req, s)),
    trust: trustScore(l.ordersCompleted, l.ordersOnTime, s),
    fill: req.quantity === null ? 1 : Math.min(1, l.availableBase / req.quantity),
  };
  const w = weightsFor(req.buyerType, s);
  const score = round9(w.price * parts.price + w.fresh * parts.fresh + w.near * parts.near + w.trust * parts.trust + w.fill * parts.fill);
  return { listing: l, distanceKm: km, travelHours: tHours, hoursUsed, tripCost: km === null ? null : tripCost(km, s), parts, score };
}

/** Steps 2 and 3 together: the listings this buyer may see, best first. */
export function matchListings(
  listings: ListingFacts[],
  req: MatchRequest,
  rules: AreaRule[],
  /** Shop price for the listing's item where the buyer is (or where the listing is, if the buyer's area is unknown). */
  shopPriceFor: (l: ListingFacts) => number | null,
  s: EngineSettings,
): Match[] {
  return listings
    .filter((l) => checkHardRules(l, req, rules, s) === null)
    .map((l) => scoreListing(l, req, shopPriceFor(l), s))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
        a.listing.priceBase - b.listing.priceBase ||
        (a.listing.id < b.listing.id ? -1 : a.listing.id > b.listing.id ? 1 : 0),
    );
}
