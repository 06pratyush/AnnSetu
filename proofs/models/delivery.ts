// Shared household trips (supabase/migrations/20261006000001_delivery_split.sql): who pays what.

/**
 * release_batch's split, in paise. Savings S cover the trip T: T is shared in proportion to each
 * household's saving, rounded down, with the paise left over going one each to the largest
 * remainders (ties to the earlier order). Otherwise each household pays its saving. `savings`
 * must be in order-id order, as the database breaks ties.
 */
export function splitTrip(tripPaise: number, savings: number[]): number[] {
  const total = savings.reduce((a, b) => a + b, 0);
  if (total < tripPaise || total === 0) return [...savings];
  const base = savings.map((s) => Math.floor((tripPaise * s) / total));
  const remainder = savings.map((s, i) => tripPaise * s - base[i] * total);
  let left = tripPaise - base.reduce((a, b) => a + b, 0);
  const order = savings.map((_, i) => i).sort((a, b) => remainder[b] - remainder[a] || a - b);
  for (const i of order) {
    if (left <= 0) break;
    base[i] += 1;
    left--;
  }
  return base;
}

/** The split the deployed version used: by weight, rounded to paise. */
export const splitByWeight = (tripPaise: number, loads: number[]) => {
  const total = loads.reduce((a, b) => a + b, 0);
  return loads.map((l) => Math.round((tripPaise * l) / total));
};
