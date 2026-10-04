// The live mandi price feed: parsing what data.gov.in returns, and how the engine then picks a price.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { aggregate, buildCommodityIndex, canonicalDistrict, median, normalizeKeys, parseArrivalDate, parseRecord } from "../scripts/prices/agmarknet.mjs";
import { as, freshDb, rows } from "./pg";

type Row = { item_id: string; state: string; district: string; source: string; price_date: string; mandi_price: number; shop_price: number | null; markets: number };

const root = process.cwd();
const catalogue = JSON.parse(readFileSync(path.join(root, "supabase/catalogue.json"), "utf8"));
const page = JSON.parse(readFileSync(path.join(root, "tests/fixtures/agmarknet-page.json"), "utf8"));
const index = buildCommodityIndex(catalogue.items ?? catalogue);
const observations = page.records.map((r: unknown) => parseRecord(r, index)).filter(Boolean);
const priceRows: Row[] = aggregate(observations, "2026-10-05T06:00:00.000Z");
const find = (item: string, state: string, district: string) => priceRows.find((r) => r.item_id === item && r.state === state && r.district === district);

describe("mandi price feed: reading the source", () => {
  it("reads every key spelling the exports use", () => {
    expect(normalizeKeys({ Modal_x0020_Price: "1", Arrival_Date: "x", "min price": "2" })).toEqual({ modalprice: "1", arrivaldate: "x", minprice: "2" });
  });

  it("accepts only real dates", () => {
    expect(parseArrivalDate("05/10/2026")).toBe("2026-10-05");
    expect(parseArrivalDate("5-1-2026")).toBe("2026-01-05");
    expect(parseArrivalDate("31/02/2026")).toBeNull();
    expect(parseArrivalDate("2026-10-05")).toBeNull();
  });

  it("maps Agmarknet commodity names to catalogue items and drops what it can't trust", () => {
    // 13 records: an unknown commodity, a zero price, an impossible date and a price of Rs 25,000/kg are dropped.
    expect(page.records).toHaveLength(13);
    expect(observations).toHaveLength(9);
    const items = new Set(observations.map((o: { itemId: string }) => o.itemId));
    expect([...items].sort()).toEqual(["cucumber", "okra", "onion", "tomato", "wheat"]);
    expect(canonicalDistrict("Pune District")).toBe("Pune");
  });

  it("turns rupees per quintal into a median per kg for each district, state and the country", () => {
    // Jaipur: Jaipur (F&V) Rs 15 and Chomu's latest day Rs 17 (its older Rs 28 is ignored).
    expect(find("tomato", "Rajasthan", "Jaipur")).toMatchObject({ mandi_price: 16, markets: 2, price_date: "2026-10-05", source: "agmarknet", shop_price: null });
    expect(find("tomato", "Rajasthan", "")).toMatchObject({ mandi_price: 17, markets: 3 });
    expect(find("tomato", "", "")).toMatchObject({ mandi_price: 16, markets: 4, price_date: "2026-10-05" });
    expect(find("tomato", "Maharashtra", "Pune")).toMatchObject({ mandi_price: 11, price_date: "2026-10-04" });
    expect(find("okra", "Maharashtra", "Pune")?.mandi_price).toBe(30);
    // "Chattisgarh" is filed under the name addresses use; "1,200" reads as 1200.
    expect(find("cucumber", "Chhattisgarh", "Raipur")?.mandi_price).toBe(12);
    expect(find("onion", "Uttar Pradesh", "Agra")).toMatchObject({ mandi_price: 21, markets: 1 });
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("mandi price feed: the engine's choice of price", () => {
  let db: PGlite;
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

  async function save(list: Row[]) {
    await db.exec("set role service_role");
    try {
      await db.query(
        `insert into public.reference_prices select * from json_populate_recordset(null::public.reference_prices, $1)
         on conflict (item_id, state, district, source) do update set price_date = excluded.price_date,
           mandi_price = excluded.mandi_price, shop_price = excluded.shop_price, markets = excluded.markets, fetched_at = excluded.fetched_at`,
        [JSON.stringify(list.map((r) => ({ ...r, price_date: today })))],
      );
    } finally {
      await db.exec("reset role");
    }
  }
  const ref = async (item: string, state: string | null, district: string | null) =>
    (await rows<{ mandi: string; shop: string; source: string; area: string }>(db, `select * from public.price_ref($1, $2, $3)`, [item, state, district]))[0];

  it("uses the most local live price, and estimates the shop price from the category markup", async () => {
    db = await freshDb();
    await save(priceRows);
    // An address saved as "Jaipur District" still finds Jaipur's mandis. Vegetables: shop = 3.0 x mandi.
    const jaipur = await ref("tomato", "rajasthan", "Jaipur District");
    expect(jaipur).toMatchObject({ mandi: "16.00", source: "agmarknet", area: "Jaipur" });
    expect(Number(jaipur.shop)).toBe(48);
    expect(await ref("tomato", "Rajasthan", "Kota")).toMatchObject({ mandi: "17.00", source: "agmarknet", area: "Rajasthan" });
    expect(await ref("tomato", "Kerala", "Ernakulam")).toMatchObject({ mandi: "16.00", source: "agmarknet", area: "India" });
    expect(await ref("cucumber", "Chhattisgarh", "Raipur")).toMatchObject({ mandi: "12.00", area: "Raipur" });
    // No live price for spinach: the sample price stays in use.
    expect((await ref("spinach", "Rajasthan", "Jaipur")).source).toBe("sample");
  });

  it("re-running the feed updates rows in place", async () => {
    await save(priceRows.map((r) => (r.item_id === "tomato" && r.district === "Jaipur" ? { ...r, mandi_price: 18 } : r)));
    expect((await ref("tomato", "Rajasthan", "Jaipur")).mandi).toBe("18.00");
    const n = await rows<{ n: number }>(db, `select count(*)::int as n from public.reference_prices where source = 'agmarknet'`);
    expect(n[0].n).toBe(priceRows.length);
  });

  it("forgets live prices after 30 days instead of using stale ones", async () => {
    await db.exec(`update public.reference_prices set price_date = current_date - 31 where source = 'agmarknet' and item_id = 'tomato'`);
    expect((await ref("tomato", "Rajasthan", "Jaipur")).source).toBe("sample");
  });

  it("browsers can read prices but never write them", async () => {
    await expect(as(db, null, () => db.query(`insert into public.reference_prices (item_id, source, price_date, mandi_price) values ('tomato', 'manual', current_date, 1)`))).rejects.toThrow(/permission denied/);
    const visible = await as(db, null, () => rows(db, `select 1 from public.reference_prices limit 1`));
    expect(visible).toHaveLength(1);
  });
});
