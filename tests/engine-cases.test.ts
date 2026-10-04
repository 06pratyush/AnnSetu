// The design's four cases, the household grouping step, trust and one-step reserve, run against
// the real migrations in an in-memory Postgres.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { SEED_CATALOGUE } from "@/lib/matching/catalogue-data";
import { indexCatalogue, searchCatalogue } from "@/lib/matching/search";
import { as, createUser, freshDb, rows } from "./pg";

const KM_PER_DEG = (6371 * Math.PI) / 180;
const FARM = { lat: 26.9, lng: 75.8 }; // near Jaipur
const north = (km: number) => ({ lat: FARM.lat + km / KM_PER_DEG, lng: FARM.lng });

let db: PGlite;
let farmer: string;

async function addFarmAddress(id: string) {
  await as(db, id, () =>
    db.query(
      `insert into public.addresses (label, line1, village_city, district, state, pincode, lat, lng) values ('farm','Plot 1','Chomu','Jaipur','Rajasthan','303702',$1,$2)`,
      [FARM.lat, FARM.lng],
    ),
  );
}

async function listing(item: string, price: number, qty: number, minOrder: number, hoursAgo = 2, radius = 100) {
  const harvested = new Date(Math.floor(Date.now() / 1000) * 1000 - hoursAgo * 3600_000).toISOString();
  return as(db, farmer, async () =>
    (
      await rows<{ id: string }>(
        db,
        `insert into public.produce (item_id, category, name, unit, price_per_unit, qty_listed, min_order_qty, harvested_at, delivery_radius_km)
         values ($1, 'others', '', 'kg', $2, $3, $4, $5, $6) returning id`,
        [item, price, qty, minOrder, harvested, radius],
      )
    )[0].id,
  );
}

const delivery = (p: { lat: number; lng: number }, pincode = "302001") =>
  JSON.stringify({ name: "Buyer", phone: "9000000000", line1: "1 Main Rd", village_city: "Jaipur", district: "Jaipur", state: "Rajasthan", pincode, lat: p.lat, lng: p.lng });

async function buyer(type: "individual" | "industrial", maxKm?: number) {
  const id = await createUser(db, { role: "consumer", consumer_type: type, full_name: `${type} buyer` });
  if (maxKm) await db.query(`update public.buyer_details set max_distance_km = $2 where user_id = $1`, [id, maxKm]);
  return id;
}

async function order(buyerId: string, produceId: string, qty: number, at: { lat: number; lng: number }, pincode?: string) {
  return as(db, buyerId, async () => (await rows<{ r: { orders: { order_id: string; status: string; delivery_fee: number; batch: { id: string; status: string } | null }[] } }>(
    db,
    `select public.place_order($1::jsonb, $2::jsonb) as r`,
    [JSON.stringify([{ produce_id: produceId, quantity: qty }]), delivery(at, pincode)],
  ))[0].r.orders[0]);
}

beforeAll(async () => {
  db = await freshDb();
  farmer = await createUser(db, { role: "farmer", full_name: "Kaka Farmer" });
  await addFarmAddress(farmer);
});

describe("Case 1, a restaurant", () => {
  it("finds tomato from 'tamatr' and shows the 20 km farm with a Rs 520 trip", async () => {
    const search = searchCatalogue(indexCatalogue(SEED_CATALOGUE), "tamatr");
    expect(search.hits[0].item.id).toBe("tomato");
    const id = await listing("tomato", 24.9, 200, 10);
    const restaurant = north(20);
    const res = await rows<{ id: string; trip_cost: string; distance_km: string }>(
      db,
      `select id, trip_cost, distance_km from public.match_listings('tomato', 60, $1, $2, 'industrial', null, 'Rajasthan', 'Jaipur')`,
      [restaurant.lat, restaurant.lng],
    );
    expect(res.map((r) => r.id)).toContain(id);
    const row = res.find((r) => r.id === id)!;
    expect(Number(row.distance_km)).toBe(20);
    expect(Number(row.trip_cost)).toBe(520);
  });
});

describe("Case 2, the same trip for two crops", () => {
  it("is decided by hours: spinach reaches the 50 km buyer (14.2 h of 14.4) but not the 60 km one (14.6 h)", async () => {
    const potato = await listing("potato", 20, 100, 1, 12);
    const spinach = await listing("spinach", 30, 50, 1, 12);
    const at50 = north(50);
    const at60 = north(60);
    const seen = async (p: { lat: number; lng: number }) =>
      (await rows<{ id: string; hours_used: string }>(db, `select id, hours_used from public.match_listings(null, null, $1, $2, 'individual', 100)`, [p.lat, p.lng]));
    const s50 = await seen(at50);
    const s60 = await seen(at60);
    expect(s50.map((r) => r.id)).toEqual(expect.arrayContaining([potato, spinach]));
    expect(s60.map((r) => r.id)).toContain(potato);
    expect(s60.map((r) => r.id)).not.toContain(spinach);
    expect(Number(s50.find((r) => r.id === spinach)!.hours_used)).toBeCloseTo(14.2, 1);
    const hidden = await rows<{ reason: string; listings: string }>(db, `select * from public.match_hidden('spinach', null, $1, $2, 'individual', 100)`, [at60.lat, at60.lng]);
    expect(hidden).toEqual([{ reason: "not_fresh_on_arrival", listings: expect.anything() }]);
  });
});

describe("Case 4 and the grouping step: households sharing one trip", () => {
  it("pools 3 kg household orders 20 km away and releases the trip once their savings cover it", async () => {
    // Listed at Rs 22.35 (about the suggested rate for a 36 kg trip). Sample prices: mandi 15, shop 45.
    const tomato = await listing("tomato", 22.35, 500, 1);
    const drop = north(20);
    const fees: number[] = [];
    let firstBatch = "";
    for (let i = 1; i <= 12; i++) {
      const hh = await buyer("individual", 30);
      const o = await order(hh, tomato, 3, drop);
      if (i === 1) firstBatch = o.batch!.id;
      if (i < 8) expect(o.status).toBe("pooling");
      if (i === 8) expect(o.status).toBe("placed"); // 8 x 3 x (45 - 22.35) = 543.6 >= 520
      if (i > 8) expect(o.batch!.id).not.toBe(firstBatch);
      fees.push(Number(o.delivery_fee));
    }
    const first = await rows<{ status: string; delivery_fee: string }>(db, `select status, delivery_fee from public.orders where batch_id = $1`, [firstBatch]);
    expect(first).toHaveLength(8);
    expect(first.every((o) => o.status === "placed" && Number(o.delivery_fee) === 65)).toBe(true); // 520 x 3 / 24
    const batch = (await rows<{ status: string; below_break_even: boolean; load_qty: string; trip_cost: string }>(db, `select * from public.delivery_batches where id = $1`, [firstBatch]))[0];
    expect(batch).toMatchObject({ status: "released", below_break_even: false });
    expect(Number(batch.trip_cost)).toBe(520);
    // Each household pays 22.35 + 65/3 = 44.02 a kg with delivery, under the Rs 45 shop price.
    expect(22.35 + 65 / 3).toBeLessThan(45);
  });

  it("quotes the fee before ordering and how far the batch is from shipping", async () => {
    const tomato = (await rows<{ id: string }>(db, `select id from public.produce where item_id = 'tomato' and price_per_unit = 22.35`))[0].id;
    const hh = await buyer("individual", 30);
    const drop = north(20);
    const q = await as(db, hh, () =>
      rows<Record<string, string | boolean>>(db, `select * from public.quote_delivery($1::jsonb, $2, $3, '302001')`, [JSON.stringify([{ produce_id: tomato, quantity: 3 }]), drop.lat, drop.lng]),
    );
    expect(q).toHaveLength(1);
    expect(q[0].pooled).toBe(true);
    expect(Number(q[0].batch_load)).toBe(12); // households 9-12
    expect(Number(q[0].fee_now)).toBe(104); // 520 x 3 / 15
    expect(q[0].ships_now).toBe(false);

    // A PIN code with no open batch: this order would open one, closing a window (24 h) from now.
    const fresh = await as(db, hh, () =>
      rows<{ batch_load: string; cutoff_at: string }>(db, `select * from public.quote_delivery($1::jsonb, $2, $3, '302099')`, [JSON.stringify([{ produce_id: tomato, quantity: 3 }]), drop.lat, drop.lng]),
    );
    expect(Number(fresh[0].batch_load)).toBe(0);
    const hoursAhead = (new Date(fresh[0].cutoff_at).getTime() - Date.now()) / 3600_000;
    expect(hoursAhead).toBeGreaterThan(23.9);
    expect(hoursAhead).toBeLessThan(24.1);
  });

  it("releases an under-filled batch at its cut-off, flagged for the farmer to decide", async () => {
    await db.exec(`update public.delivery_batches set cutoff_at = now() - interval '1 minute' where status = 'open'`);
    const released = await rows<{ n: number }>(db, `select public.release_due_batches() as n`);
    expect(released[0].n).toBe(1);
    const b = (await rows<{ id: string; below_break_even: boolean; status: string }>(db, `select * from public.delivery_batches where status = 'released' order by released_at desc limit 1`))[0];
    expect(b).toMatchObject({ status: "released", below_break_even: true });
    const fees = await rows<{ delivery_fee: string }>(db, `select delivery_fee from public.orders where batch_id = $1`, [b.id]);
    expect(fees.map((f) => Number(f.delivery_fee))).toEqual([130, 130, 130, 130]); // 520 x 3 / 12
  });

  it("a household leaving a batch frees its stock and shrinks the batch", async () => {
    const tomato = await listing("tomato", 22.35, 50, 1);
    const hh = await buyer("individual", 30);
    const o = await order(hh, tomato, 3, north(20), "302002");
    const before = (await rows<{ qty_available: string }>(db, `select qty_available from public.produce where id = $1`, [tomato]))[0];
    expect(Number(before.qty_available)).toBe(47);
    await as(db, hh, () => db.query(`select public.update_order_status($1, 'cancelled')`, [o.order_id]));
    const after = (await rows<{ qty_available: string }>(db, `select qty_available from public.produce where id = $1`, [tomato]))[0];
    expect(Number(after.qty_available)).toBe(50);
    const b = (await rows<{ status: string }>(db, `select status from public.delivery_batches where id = $1`, [o.batch!.id]))[0];
    expect(b.status).toBe("cancelled");
  });
});

describe("trust", () => {
  it("counts on-time and late deliveries, and a farmer cancelling after accepting", async () => {
    const f = await createUser(db, { role: "farmer", full_name: "Trust Farmer" });
    await as(db, f, () => db.query(`insert into public.addresses (label, line1, village_city, district, state, pincode, lat, lng) values ('farm','x','x','Jaipur','Rajasthan','303702',$1,$2)`, [FARM.lat, FARM.lng]));
    const p = await as(db, f, async () => (await rows<{ id: string }>(db, `insert into public.produce (item_id, category, name, unit, price_per_unit, qty_listed, min_order_qty) values ('onion','others','','kg',30,500,1) returning id`))[0].id);
    const biz = await buyer("industrial");
    const place = () => order(biz, p, 10, north(10));
    const step = (id: string, s: string, by?: string) => as(db, f, () => db.query(`select public.update_order_status($1, $2::public.order_status, $3)`, [id, s, by ?? null]));
    const stats = async () => (await rows<{ orders_completed: number; orders_on_time: number }>(db, `select orders_completed, orders_on_time from public.farmer_details where user_id = $1`, [f]))[0];

    const a = await place();
    await step(a.order_id, "accepted");
    await step(a.order_id, "out_for_delivery");
    await step(a.order_id, "delivered");
    expect(await stats()).toEqual({ orders_completed: 1, orders_on_time: 1 });

    const b = await place();
    await step(b.order_id, "accepted");
    await db.query(`update public.orders set deliver_by = now() - interval '1 hour' where id = $1`, [b.order_id]);
    await step(b.order_id, "out_for_delivery");
    await step(b.order_id, "delivered");
    expect(await stats()).toEqual({ orders_completed: 2, orders_on_time: 1 });

    const c = await place();
    await step(c.order_id, "accepted");
    await step(c.order_id, "cancelled");
    expect(await stats()).toEqual({ orders_completed: 3, orders_on_time: 1 });
    const trust = (await rows<{ part_trust: number }>(db, `select part_trust from public.match_listings('onion', null, $1, $2, 'industrial') where farmer_id = $3`, [north(10).lat, north(10).lng, f]))[0];
    expect(trust.part_trust).toBeCloseTo((1 + 8) / (3 + 10), 9);
  });
});

describe("step 4, one-step reserve", () => {
  it("200 buyers each ordering 3 kg from 100 kg: 33 accepted, 1 kg left, nothing oversold", async () => {
    const p = await listing("garlic", 80, 100, 1);
    let accepted = 0;
    let refused = 0;
    for (let i = 0; i < 200; i++) {
      const b = await buyer("industrial");
      try {
        await order(b, p, 3, north(5));
        accepted++;
      } catch (e) {
        expect(String((e as Error).message)).toMatch(/insufficient_stock|unavailable/);
        refused++;
      }
    }
    const left = (await rows<{ qty_available: string; qty_reserved: string }>(db, `select qty_available, qty_reserved from public.produce where id = $1`, [p]))[0];
    console.log(`one-step reserve: ${accepted} accepted, ${refused} refused, ${left.qty_available} kg left`);
    expect(accepted).toBe(33);
    expect(Number(left.qty_available)).toBe(1);
    expect(Number(left.qty_reserved)).toBe(99);
  });
});
