// Pure helpers for the Agmarknet mandi price feed (data.gov.in resource 9ef84268-d588-465a-a308-a864a43d0070,
// "Current daily price of various commodities from various markets"). No network here, so it is unit-tested.
//
// A record looks like:
//   { state: "Rajasthan", district: "Jaipur", market: "Jaipur (F&V)", commodity: "Tomato", variety: "Local",
//     grade: "FAQ", arrival_date: "05/10/2026", min_price: "1200", max_price: "1800", modal_price: "1500" }
// Prices are rupees per quintal (100 kg). Older exports spell the keys "Modal_x0020_Price" and so on.

export const RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
export const API_BASE = `https://api.data.gov.in/resource/${RESOURCE_ID}`;

/** Agmarknet state spellings → the names OpenStreetMap (and so buyers' saved addresses) use. */
export const STATE_ALIASES = {
  chattisgarh: "Chhattisgarh",
  orissa: "Odisha",
  pondicherry: "Puducherry",
  uttrakhand: "Uttarakhand",
  "nct of delhi": "Delhi",
  "jammu & kashmir": "Jammu and Kashmir",
  "andaman & nicobar": "Andaman and Nicobar Islands",
  "andaman and nicobar": "Andaman and Nicobar Islands",
  "dadra & nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  telengana: "Telangana",
};

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Commodity names compared without case, spaces or punctuation: "Bhindi(Ladies Finger)" → "bhindiladiesfinger". */
export const commodityKey = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]/g, "");

export function canonicalState(s) {
  const v = clean(s);
  return STATE_ALIASES[v.toLowerCase()] ?? v;
}

/** "Pune District" and "Pune" are the same place; keep the bare name. */
export const canonicalDistrict = (s) => clean(s).replace(/\s+(district|dist\.?)$/i, "");

/** Lower-case keys with "_x0020_", spaces and underscores removed, so every export spelling reads the same. */
export function normalizeKeys(rec) {
  const out = {};
  for (const [k, v] of Object.entries(rec ?? {})) out[k.toLowerCase().replace(/_x0020_|[\s_]/g, "")] = v;
  return out;
}

/** "05/10/2026" → "2026-10-05"; null when it isn't a real date. */
export function parseArrivalDate(s) {
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(clean(s));
  if (!m) return null;
  const [, d, mo, y] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/** Map every Agmarknet commodity name in the catalogue to its item. Only kg items: Agmarknet quotes per quintal. */
export function buildCommodityIndex(catalogue) {
  const index = new Map();
  for (const item of catalogue) {
    if (item.unit !== "kg") continue;
    for (const name of item.agmarknet ?? []) index.set(commodityKey(name), item.id);
  }
  return index;
}

// A modal price outside Rs 0.5-10,000 a kg is a typing or unit error in the source, not a price.
const MIN_PER_KG = 0.5;
const MAX_PER_KG = 10_000;

/** One usable observation, or null: { itemId, state, district, market, date, perKg }. */
export function parseRecord(raw, index) {
  const r = normalizeKeys(raw);
  const itemId = index.get(commodityKey(r.commodity));
  if (!itemId) return null;
  const perQuintal = Number(String(r.modalprice ?? "").replace(/,/g, ""));
  const perKg = perQuintal / 100;
  if (!Number.isFinite(perKg) || perKg < MIN_PER_KG || perKg > MAX_PER_KG) return null;
  const date = parseArrivalDate(r.arrivaldate);
  const state = canonicalState(r.state);
  if (!date || !state) return null;
  return { itemId, state, district: canonicalDistrict(r.district), market: clean(r.market), date, perKg };
}

export function median(values) {
  const v = [...values].sort((a, b) => a - b);
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const round2 = (x) => Math.round(x * 100) / 100;

/**
 * Median modal price per item for every district, state and the whole country, so the engine can
 * use the most local price it has. Only each market's latest day counts.
 * Returns reference_prices rows (source 'agmarknet', mandi price only; the shop price is
 * estimated in the database from the category markup).
 */
export function aggregate(observations, fetchedAt = new Date().toISOString()) {
  // Latest observation per (item, market): a feed page can hold several days for one market.
  const latest = new Map();
  for (const o of observations) {
    const k = `${o.itemId}|${o.state}|${o.district}|${o.market}`;
    const prev = latest.get(k);
    if (!prev || o.date > prev.date) latest.set(k, o);
  }
  const groups = new Map();
  const add = (itemId, state, district, o) => {
    const k = `${itemId}|${state}|${district}`;
    let g = groups.get(k);
    if (!g) groups.set(k, (g = { itemId, state, district, prices: [], markets: new Set(), date: o.date }));
    g.prices.push(o.perKg);
    g.markets.add(`${o.state}|${o.district}|${o.market}`);
    if (o.date > g.date) g.date = o.date;
  };
  for (const o of latest.values()) {
    if (o.district) add(o.itemId, o.state, o.district, o);
    add(o.itemId, o.state, "", o);
    add(o.itemId, "", "", o);
  }
  return [...groups.values()]
    .map((g) => ({
      item_id: g.itemId,
      state: g.state,
      district: g.district,
      source: "agmarknet",
      price_date: g.date,
      mandi_price: round2(median(g.prices)),
      shop_price: null,
      markets: g.markets.size,
      fetched_at: fetchedAt,
    }))
    .filter((row) => row.mandi_price > 0)
    .sort((a, b) => a.item_id.localeCompare(b.item_id) || a.state.localeCompare(b.state) || a.district.localeCompare(b.district));
}
