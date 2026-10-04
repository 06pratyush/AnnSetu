// Engine settings. The database row public.engine_settings holds the live values; these defaults
// mirror its column defaults and are used by tests and as a fallback before the row loads.

export type Weights = { price: number; fresh: number; near: number; trust: number; fill: number };

export interface EngineSettings {
  /** Road distance = straight-line distance x roadFactor. */
  roadFactor: number;
  /** Average delivery speed, km per hour. */
  speedKmph: number;
  /** Share of shelf life that may be used up on arrival (hard rule). */
  freshnessLimit: number;
  /** Cost of one road kilometre, rupees; a trip is there and back. */
  costPerRoadKm: number;
  /** Farmer's share of the room between mandi and shop price. */
  farmerShare: number;
  /** Demand nudge limit, as a share of the room. */
  nudgeCap: number;
  /** Open requests needed nearby before the demand nudge switches on. */
  nudgeMinRequests: number;
  /** Big-lot cut per 100 base units, and its maximum. */
  lotCutPer100: number;
  lotCutMax: number;
  /** Trust starting point: imaginary past orders on time / in total. */
  trustPriorOnTime: number;
  trustPriorTotal: number;
  wHousehold: Weights;
  wBusiness: Weights;
  /** Farthest distance a buyer accepts unless they set their own, km. */
  householdMaxKm: number;
  businessMaxKm: number;
  /** How far a farmer delivers unless they set their own, km. */
  farmerRadiusKm: number;
  requireVerified: boolean;
  /** How long a household batch collects orders before it is released anyway, hours. */
  batchWindowHours: number;
  /** Break-even load used when an item has no reference prices. */
  fallbackBreakEvenKg: number;
  /** Shop price estimate = mandi price x markup, per category, when no shop price is known. */
  shopMarkup: Record<string, number>;
  /** Search closeness cut-off. */
  searchCutoff: number;
}

export const DEFAULT_SETTINGS: EngineSettings = {
  roadFactor: 1.3,
  speedKmph: 30,
  freshnessLimit: 0.6,
  costPerRoadKm: 10,
  farmerShare: 0.5,
  nudgeCap: 0.25,
  nudgeMinRequests: 20,
  lotCutPer100: 0.05,
  lotCutMax: 0.05,
  trustPriorOnTime: 8,
  trustPriorTotal: 10,
  wHousehold: { price: 0.3, fresh: 0.3, near: 0.2, trust: 0.2, fill: 0 },
  wBusiness: { price: 0.35, fresh: 0.1, near: 0.05, trust: 0.3, fill: 0.2 },
  householdMaxKm: 25,
  businessMaxKm: 100,
  farmerRadiusKm: 40,
  requireVerified: false,
  batchWindowHours: 24,
  fallbackBreakEvenKg: 20,
  shopMarkup: { vegetables: 3.0, fruits: 2.7, grains: 1.5, pulses: 1.4, spices: 1.8, oilseeds: 1.5, dairy: 1.35, others: 2.0 },
  searchCutoff: 0.55,
};

/** Maps the snake_case database row onto EngineSettings. */
export function settingsFromRow(row: Record<string, unknown> | null | undefined): EngineSettings {
  if (!row) return DEFAULT_SETTINGS;
  const n = (k: string, d: number) => (row[k] === null || row[k] === undefined ? d : Number(row[k]));
  const w = (k: string, d: Weights): Weights => {
    const v = row[k] as Partial<Weights> | undefined;
    return v ? { price: Number(v.price ?? d.price), fresh: Number(v.fresh ?? d.fresh), near: Number(v.near ?? d.near), trust: Number(v.trust ?? d.trust), fill: Number(v.fill ?? d.fill) } : d;
  };
  const d = DEFAULT_SETTINGS;
  return {
    roadFactor: n("road_factor", d.roadFactor),
    speedKmph: n("speed_kmph", d.speedKmph),
    freshnessLimit: n("freshness_limit", d.freshnessLimit),
    costPerRoadKm: n("cost_per_road_km", d.costPerRoadKm),
    farmerShare: n("farmer_share", d.farmerShare),
    nudgeCap: n("nudge_cap", d.nudgeCap),
    nudgeMinRequests: n("nudge_min_requests", d.nudgeMinRequests),
    lotCutPer100: n("lot_cut_per_100", d.lotCutPer100),
    lotCutMax: n("lot_cut_max", d.lotCutMax),
    trustPriorOnTime: n("trust_prior_on_time", d.trustPriorOnTime),
    trustPriorTotal: n("trust_prior_total", d.trustPriorTotal),
    wHousehold: w("w_household", d.wHousehold),
    wBusiness: w("w_business", d.wBusiness),
    householdMaxKm: n("household_max_km", d.householdMaxKm),
    businessMaxKm: n("business_max_km", d.businessMaxKm),
    farmerRadiusKm: n("farmer_radius_km", d.farmerRadiusKm),
    requireVerified: Boolean(row.require_verified ?? d.requireVerified),
    batchWindowHours: n("batch_window_hours", d.batchWindowHours),
    fallbackBreakEvenKg: n("fallback_break_even_kg", d.fallbackBreakEvenKg),
    shopMarkup: (row.shop_markup as Record<string, number>) ?? d.shopMarkup,
    searchCutoff: n("search_cutoff", d.searchCutoff),
  };
}
