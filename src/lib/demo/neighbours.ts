// Demo mode only: made-up farms and buyers near a newly saved address, so a prototype has a market
// to browse and requests to answer wherever it is tried. They are ordinary rows marked by an
// @annsetu.demo email; nobody can sign in as them, and real accounts are never touched.
import type { Transaction } from "@electric-sql/pglite";
import catalogue from "../../../supabase/catalogue.json";
import { asOwner, flushDemo } from "./db";

type CatItem = { id: string; unit: string; shelf_life_hours: number; sample_mandi?: number };
const ITEMS = new Map((catalogue as { items: CatItem[] }).items.map((i) => [i.id, i]));

const FARMS = [
  { name: "Ramesh Patil", farm: "Patil Farm", crops: ["tomato", "onion", "potato", "green-chilli"], verified: true, done: 41, onTime: 38, organic: false },
  { name: "Sunita Devi", farm: "Sunita Organic Farm", crops: ["spinach", "coriander-leaves", "cauliflower", "okra"], verified: true, done: 12, onTime: 11, organic: true },
  { name: "Gurpreet Singh", farm: "Singh Dairy & Fields", crops: ["milk", "paneer", "wheat", "banana"], verified: false, done: 0, onTime: 0, organic: false },
];
const BUYERS = [
  { name: "Hotel Annapurna", type: "industrial", business: "Hotel Annapurna", wants: [["onion", 50], ["tomato", 30], ["paneer", 10]] },
  { name: "Meena Sharma", type: "individual", business: null, wants: [["spinach", 2], ["mango", 3]] },
] as const;

export interface Place {
  lat: number;
  lng: number;
  district: string;
  state: string;
  pincode: string;
}

const KM_PER_DEG = (6371 * Math.PI) / 180;
/** A point km away at a bearing, close enough for a few km. */
function offset(p: Place, km: number, bearingDeg: number) {
  const b = (bearingDeg * Math.PI) / 180;
  return { lat: p.lat + (km * Math.cos(b)) / KM_PER_DEG, lng: p.lng + (km * Math.sin(b)) / (KM_PER_DEG * Math.cos((p.lat * Math.PI) / 180)) };
}
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Where the demo market starts before anyone shares a location. */
export const FIRST_PLACE: Place = { lat: 26.9124, lng: 75.7873, district: "Jaipur", state: "Rajasthan", pincode: "302001" };

type Run = <T>(fn: (tx: Transaction) => Promise<T>) => Promise<T>;

/**
 * Adds demo farms and buyers near this place unless it already has some. Returns what it added.
 * `run` lets the database's first-time setup use it before the database is handed out.
 */
export async function addDemoNeighbours(place: Place, run?: Run): Promise<{ farms: number; buyers: number }> {
  const added = await (run ?? asOwner)(async (tx) => {
    const near = async (sql: string, km: number) => Number((await tx.query<{ n: number }>(sql, [place.lat, place.lng, km])).rows[0].n);
    const listings = await near(`select count(*) as n from public.produce where status = 'active' and lat is not null and public.geo_km($1, $2, lat, lng) <= $3`, 20);
    const requests = await near(`select count(*) as n from public.demand_requests where status = 'open' and lat is not null and public.geo_km($1, $2, lat, lng) <= $3`, 30);
    let farms = 0;
    let buyers = 0;

    const person = async (fullName: string, meta: Record<string, unknown>, at: { lat: number; lng: number }, label: string) => {
      const id = crypto.randomUUID();
      await tx.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `demo-${id.slice(0, 8)}@annsetu.demo`, JSON.stringify({ full_name: fullName, preferred_lang: "hi", ...meta })]);
      await tx.query(`update public.profiles set onboarded = true, phone = $2 where id = $1`, [id, `98${Math.floor(10_000_000 + Math.random() * 89_999_999)}`]);
      await tx.query(
        `insert into public.addresses (user_id, label, line1, village_city, district, state, pincode, lat, lng, is_default)
         values ($1, $2, 'Demo address', $3, $3, $4, $5, $6, $7, true)`,
        [id, label, place.district || "Demo", place.state || "Demo", place.pincode, at.lat, at.lng],
      );
      return id;
    };

    if (listings < 4) {
      for (const [k, f] of FARMS.entries()) {
        const at = offset(place, 4 + k * 4.5, 40 + k * 120);
        const id = await person(f.name, { role: "farmer" }, at, "farm");
        await tx.query(
          `update public.farmer_details set farm_name = $2, farm_size_acres = $3, main_crops = $4, verified = $5, orders_completed = $6, orders_on_time = $7 where user_id = $1`,
          [id, f.farm, 3 + k * 2.5, f.crops, f.verified, f.done, f.onTime],
        );
        for (const [j, itemId] of f.crops.entries()) {
          const item = ITEMS.get(itemId);
          if (!item?.sample_mandi) continue;
          // Picked a little while ago, well within the item's shelf life.
          const hoursAgo = Math.min(2 + j * 3, item.shelf_life_hours * 0.2);
          await tx.query(
            `insert into public.produce (farmer_id, item_id, category, name, variety, unit, price_per_unit, qty_listed, min_order_qty, harvested_at, is_organic, harvest_date)
             values ($1, $2, 'others', '', null, $3, $4, $5, $6, now() - make_interval(secs => $7), $8, current_date)`,
            [id, itemId, item.unit, round2(item.sample_mandi * (1.5 + 0.1 * j)), [120, 80, 200, 60][j] ?? 50, item.unit === "kg" ? [5, 2, 10, 1][j] ?? 1 : 1, hoursAgo * 3600, f.organic],
          );
        }
        farms++;
      }
    }

    if (requests < 2) {
      for (const [k, b] of BUYERS.entries()) {
        const at = offset(place, 5 + k * 3, 200 + k * 90);
        const id = await person(b.name, { role: "consumer", consumer_type: b.type }, at, b.type === "industrial" ? "work" : "home");
        if (b.business) await tx.query(`update public.buyer_details set business_name = $2, business_type = 'restaurant' where user_id = $1`, [id, b.business]);
        for (const [itemId, qty] of b.wants) {
          const item = ITEMS.get(itemId);
          if (!item) continue;
          await tx.query(
            `insert into public.demand_requests (buyer_id, item_id, category, item_name, quantity, unit, target_price, needed_by, notes)
             values ($1, $2, 'others', $3, $4, $5, $6, current_date + 5, null)`,
            [id, itemId, itemId.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()), qty, item.unit, item.sample_mandi ? round2(item.sample_mandi * 1.8) : null],
          );
        }
        buyers++;
      }
    }
    return { farms, buyers };
  });
  if (!run) await flushDemo();
  return added;
}
