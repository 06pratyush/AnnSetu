// Speed of a match request with about 90,000 active listings. PGlite (Postgres compiled to
// WebAssembly, one thread) is slower than a real Postgres server, so these times are a ceiling.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser, freshDb, rng, rows } from "./pg";

let db: PGlite;
const LISTINGS = Number(process.env.SCALE_LISTINGS ?? 90_000);

beforeAll(async () => {
  db = await freshDb();
  const farmers: string[] = [];
  for (let i = 0; i < 200; i++) farmers.push(await createUser(db, { role: "farmer", full_name: `F${i}` }));
  await db.query(
    `insert into public.produce (farmer_id, item_id, category, name, unit, price_per_unit, qty_listed, min_order_qty, harvested_at, lat, lng, state, district)
     select f[1 + (g % array_length(f, 1))], i.id, i.category, i.name_en,
            case i.base_unit when 'kg' then 'kg' when 'litre' then 'litre' else 'piece' end::public.unit,
            10 + (g % 90), 10 + (g % 400), 1, now() - ((g % 48) || ' hours')::interval,
            8 + random() * 26, 69 + random() * 27, 'State', 'District'
     from generate_series(1, $2) g
     cross join lateral (select $1::uuid[] as f) fs
     join lateral (select * from public.items order by id offset (g % 80) limit 1) i on true`,
    [farmers, LISTINGS],
  );
}, 1_800_000);

describe("speed", () => {
  it(`answers match requests over ${LISTINGS.toLocaleString("en-IN")} active listings`, async () => {
    const active = Number((await rows<{ n: string }>(db, `select count(*) as n from public.produce where status = 'active'`))[0].n);
    const items = (await rows<{ id: string }>(db, `select id from public.items order by id`)).map((x) => x.id);
    const r = rng(11);
    const times: number[] = [];
    for (let n = 0; n < 300; n++) {
      const t0 = performance.now();
      await db.query(`select id from public.match_listings($1, $2, $3, $4, $5::public.consumer_type, null, null, null, null, false, 24)`, [
        r.pick(items),
        r.chance(0.5) ? r.int(1, 100) : null,
        r.between(9, 33),
        r.between(70, 95),
        r.pick(["individual", "industrial"]),
      ]);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const p = (q: number) => times[Math.floor(q * (times.length - 1))].toFixed(1);
    console.log(`${active.toLocaleString("en-IN")} active listings, 300 requests: half under ${p(0.5)} ms, 95 in 100 under ${p(0.95)} ms, slowest ${p(1)} ms`);
    expect(Number(p(0.95))).toBeLessThan(200);
  });
});
