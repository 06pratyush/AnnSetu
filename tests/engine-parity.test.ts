// Steps 2 and 3, checked by a second, separate program: for 2,000 random buyer requests the
// database's match_listings must return exactly the listings, order and scores that the
// TypeScript reference (src/lib/matching/engine.ts) computes from the same data.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { checkHardRules, matchListings, type AreaRule, type BuyerType, type ListingFacts, type MatchRequest } from "@/lib/matching/engine";
import { settingsFromRow, type EngineSettings } from "@/lib/matching/settings";
import { createUser, freshDb, rng, rows } from "./pg";

const NOW = Math.floor(Date.now() / 1000) * 1000; // the database refuses harvest times in the future
const NOW_ISO = new Date(NOW).toISOString();
/** India date `days` from now, yyyy-mm-dd, for area-rule date ranges around today. */
const day = (days: number) => new Date(NOW + 5.5 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const ITEMS = ["tomato", "spinach", "potato", "onion", "wheat", "milk", "mango", "coconut", "okra", "chana"];
const PLACES = [
  { state: "Maharashtra", district: "Pune" },
  { state: "Maharashtra", district: "Nashik" },
  { state: "Maharashtra", district: "Satara" },
  { state: "Gujarat", district: "Surat" },
  { state: "Gujarat", district: "Navsari" },
];
const box = { lat: [18.0, 21.0], lng: [72.6, 74.8] } as const;

let db: PGlite;
let settings: EngineSettings;
let facts: ListingFacts[];
let rules: AreaRule[];
const shopCache = new Map<string, number | null>();

async function shopPrice(itemId: string, state: string | null, district: string | null) {
  const key = `${itemId}|${state}|${district}`;
  if (!shopCache.has(key)) {
    const r = await rows<{ shop: string | null }>(db, `select shop from public.price_ref($1, $2, $3)`, [itemId, state, district]);
    shopCache.set(key, r[0]?.shop == null ? null : Number(r[0].shop));
  }
  return shopCache.get(key)!;
}

beforeAll(async () => {
  db = await freshDb();
  const r = rng(7);

  // 60 farmers, 600 listings spread over two states.
  const farmers: string[] = [];
  for (let i = 0; i < 60; i++) {
    const id = await createUser(db, { role: "farmer", full_name: `Farmer ${i}` });
    const completed = r.chance(0.3) ? 0 : r.int(1, 200);
    await db.query(
      `update public.farmer_details set verified = $2, orders_completed = $3, orders_on_time = $4, delivery_radius_km = $5 where user_id = $1`,
      [id, r.chance(0.8), completed, Math.floor(completed * r.between(0.5, 1)), r.chance(0.4) ? null : r.int(10, 120)],
    );
    farmers.push(id);
  }
  const units: Record<string, string[]> = { kg: ["kg", "quintal"], litre: ["litre"], piece: ["piece", "dozen"] };
  const base = Object.fromEntries((await rows<{ id: string; base_unit: string }>(db, `select id, base_unit from public.items`)).map((x) => [x.id, x.base_unit]));
  for (let i = 0; i < 600; i++) {
    const item = r.pick(ITEMS);
    const unit = r.pick(units[base[item]]);
    const place = r.pick(PLACES);
    const harvested = new Date(NOW - r.between(0, 600) * 3600_000);
    harvested.setUTCMilliseconds(0);
    const listed = r.int(5, 400);
    await db.query(
      `insert into public.produce (farmer_id, item_id, category, name, unit, price_per_unit, qty_listed, min_order_qty, harvested_at,
         is_organic, lat, lng, state, district, delivery_radius_km, status)
       values ($1, $2, 'others', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        r.pick(farmers), item, unit, (r.between(5, 120) * (unit === "quintal" ? 100 : unit === "dozen" ? 12 : 1)).toFixed(2), listed,
        Math.max(1, r.int(1, Math.max(1, Math.floor(listed / 10)))), harvested.toISOString(), r.chance(0.3),
        r.chance(0.97) ? r.between(box.lat[0], box.lat[1]) : null, r.between(box.lng[0], box.lng[1]),
        place.state, place.district, r.chance(0.5) ? null : r.int(10, 150), r.chance(0.9) ? "active" : "paused",
      ],
    );
  }
  // Some reservations, sales and spoilage, so available stock differs from listed stock.
  await db.exec(`update public.produce set qty_reserved = floor(qty_listed * 0.2) where random() < 0.3;
                 update public.produce set qty_sold = qty_listed - qty_reserved where random() < 0.05;`);

  // Prices: live state/district rows (some stale), manual rows, plus the seeded national samples.
  for (const item of ITEMS) {
    for (const place of PLACES) {
      if (r.chance(0.5))
        await db.query(
          `insert into public.reference_prices (item_id, state, district, source, price_date, mandi_price, shop_price) values ($1,$2,$3,'agmarknet',$4,$5,$6)`,
          [item, place.state, r.chance(0.5) ? place.district : "", r.chance(0.8) ? day(-1) : day(-60), r.between(5, 60).toFixed(2), r.chance(0.5) ? r.between(60, 150).toFixed(2) : null],
        ).catch(() => undefined);
    }
  }
  await db.query(`insert into public.reference_prices (item_id, state, district, source, price_date, shop_price) values ('tomato','Gujarat','','manual',$1, 52)`, [day(-30)]);

  // Area rules: hide spinach in Nashik, all dairy in Surat, onions in Gujarat after the request date.
  await db.query(
    `insert into public.area_rules (state, district, item_id, category, starts_on, ends_on, action) values
       ('Maharashtra', 'Nashik', 'spinach', null, $1, $2, 'hide'),
       ('Gujarat', 'Surat', null, 'dairy', $3, $4, 'hide'),
       ('Gujarat', null, 'onion', null, $5, $6, 'hide')`,
    [day(-3), day(5), day(-200), day(200), day(1), day(15)],
  );
  await db.query(
    `insert into public.area_rules (state, district, item_id, category, starts_on, ends_on, action, demand_multiplier)
     values ('Gujarat', null, 'mango', null, $1, $2, 'demand', 0.6)`,
    [day(-4), day(26)],
  );

  settings = settingsFromRow((await rows(db, `select * from public.engine_settings`))[0]);
  rules = (await rows<Record<string, unknown>>(db, `select state, district, item_id, category::text, starts_on::text, ends_on::text, action from public.area_rules`)).map((x) => ({
    state: x.state as string | null,
    district: x.district as string | null,
    itemId: x.item_id as string | null,
    category: x.category as string | null,
    startsOn: x.starts_on as string,
    endsOn: x.ends_on as string,
    action: x.action as "hide" | "demand",
  }));
  facts = (
    await rows<Record<string, unknown>>(
      db,
      `select p.id, p.item_id, p.category::text as category, p.status::text as status, fd.verified, p.lat, p.lng,
              coalesce(p.delivery_radius_km, fd.delivery_radius_km, s.farmer_radius_km)::float8 as radius,
              (p.qty_available * public.unit_factor(p.unit, i.base_unit))::float8 as avail,
              (p.min_order_qty * public.unit_factor(p.unit, i.base_unit))::float8 as min_base,
              (p.price_per_unit / public.unit_factor(p.unit, i.base_unit))::float8 as price_base,
              extract(epoch from p.harvested_at) * 1000 as harvested_ms, i.shelf_life_hours,
              fd.orders_completed, fd.orders_on_time, p.is_organic, p.state, p.district
       from public.produce p join public.items i on i.id = p.item_id
       join public.farmer_details fd on fd.user_id = p.farmer_id cross join public.engine_settings s`,
    )
  ).map((x) => ({
    id: x.id as string,
    itemId: x.item_id as string,
    category: x.category as string,
    status: x.status as string,
    farmerVerified: Boolean(x.verified),
    lat: x.lat == null ? null : Number(x.lat),
    lng: x.lng == null ? null : Number(x.lng),
    radiusKm: Number(x.radius),
    availableBase: Number(x.avail),
    minOrderBase: Number(x.min_base),
    priceBase: Number(x.price_base),
    harvestedAt: Number(x.harvested_ms),
    shelfLifeHours: Number(x.shelf_life_hours),
    ordersCompleted: Number(x.orders_completed),
    ordersOnTime: Number(x.orders_on_time),
    isOrganic: Boolean(x.is_organic),
    state: x.state as string | null,
    district: x.district as string | null,
  }));
});

function randomRequest(r: ReturnType<typeof rng>): MatchRequest {
  const place = r.chance(0.7) ? r.pick(PLACES) : null;
  const itemId = r.chance(0.8) ? r.pick(ITEMS) : null;
  return {
    itemId,
    quantity: r.chance(0.6) ? Math.round(r.between(0.5, 300) * 100) / 100 : null,
    lat: r.chance(0.85) ? r.between(box.lat[0], box.lat[1]) : null,
    lng: r.between(box.lng[0], box.lng[1]),
    buyerType: r.pick<BuyerType | null>(["individual", "industrial", null]),
    maxKm: r.chance(0.5) ? null : r.int(5, 150),
    state: place?.state ?? null,
    district: place ? (r.chance(0.8) ? place.district : null) : null,
    category: itemId === null && r.chance(0.3) ? r.pick(["vegetables", "fruits", "dairy", "grains"]) : null,
    organicOnly: r.chance(0.1),
    now: NOW,
  };
}

describe("steps 2 + 3: the database agrees with the reference program", () => {
  it("2,000 random requests: no rule-breaking listing shown, none wrongly left out, same order and scores", async () => {
    const r = rng(2026);
    let shown = 0;
    let breaking = 0;
    let missing = 0;
    let extra = 0;
    let orderDiffers = 0;
    let maxScoreDiff = 0;
    for (let n = 0; n < 2000; n++) {
      const req = randomRequest(r);
      if (req.lat === null) req.lng = null;
      const sql = await rows<{ id: string; score: number }>(
        db,
        `select id, score from public.match_listings($1, $2, $3, $4, $5::public.consumer_type, $6, $7, $8, $9::public.produce_category, $10, 500, 0, $11)`,
        [req.itemId, req.quantity, req.lat, req.lng, req.buyerType, req.maxKm, req.state, req.district, req.category, req.organicOnly, NOW_ISO],
      );
      const prices = new Map<string, number | null>();
      for (const l of facts) {
        const k = `${l.itemId}|${req.state ?? l.state}|${req.district ?? l.district}`;
        if (!prices.has(k)) prices.set(k, await shopPrice(l.itemId, req.state ?? l.state, req.district ?? l.district));
      }
      const ts = matchListings(facts, req, rules, (l) => prices.get(`${l.itemId}|${req.state ?? l.state}|${req.district ?? l.district}`) ?? null, settings);

      shown += sql.length;
      const byId = new Map(facts.map((f) => [f.id, f]));
      breaking += sql.filter((row) => checkHardRules(byId.get(row.id)!, req, rules, settings) !== null).length;
      const tsIds = new Set(ts.map((m) => m.listing.id));
      const sqlIds = new Set(sql.map((x) => x.id));
      missing += [...tsIds].filter((id) => !sqlIds.has(id)).length;
      extra += [...sqlIds].filter((id) => !tsIds.has(id)).length;
      if (sql.map((x) => x.id).join() !== ts.map((m) => m.listing.id).join()) orderDiffers++;
      sql.forEach((row, i) => {
        if (ts[i] && ts[i].listing.id === row.id) maxScoreDiff = Math.max(maxScoreDiff, Math.abs(Number(row.score) - ts[i].score));
      });
    }
    console.log(
      `2,000 requests, ${shown} listings shown: ${breaking} broke a hard rule, ${missing} wrongly left out, ${extra} shown that the reference hid, ` +
        `${orderDiffers} requests in a different order, largest score difference ${maxScoreDiff}`,
    );
    expect(shown).toBeGreaterThan(2000);
    expect(breaking).toBe(0);
    expect(missing).toBe(0);
    expect(extra).toBe(0);
    expect(orderDiffers).toBe(0);
    expect(maxScoreDiff).toBeLessThan(1e-9);
  });

  it("match_hidden counts the first rule each hidden listing breaks, as the reference does", async () => {
    const r = rng(99);
    for (let n = 0; n < 300; n++) {
      const req = { ...randomRequest(r), itemId: r.pick(ITEMS), category: null, organicOnly: false };
      if (req.lat === null) req.lng = null;
      const sql = await rows<{ reason: string; listings: string }>(
        db,
        `select reason, listings from public.match_hidden($1, $2, $3, $4, $5::public.consumer_type, $6, $7, $8, $9)`,
        [req.itemId, req.quantity, req.lat, req.lng, req.buyerType, req.maxKm, req.state, req.district, NOW_ISO],
      );
      const counts: Record<string, number> = {};
      for (const l of facts) {
        if (l.itemId !== req.itemId || l.status !== "active" || l.availableBase <= 0) continue;
        const why = checkHardRules(l, req, rules, settings);
        if (why) counts[why] = (counts[why] ?? 0) + 1;
      }
      expect(Object.fromEntries(sql.map((x) => [x.reason, Number(x.listings)]))).toEqual(counts);
    }
  });
});
