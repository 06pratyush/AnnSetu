// Runs the Supabase migrations on an in-memory Postgres (PGlite) with small stand-ins for
// Supabase's auth and storage schemas, then checks the order flow, stock maths and the
// security rules as real "anon" / "authenticated" users. Run: npm run test:db
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const db = new PGlite();

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
`;

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail && !ok ? `  -> ${detail}` : ""}`);
}

async function as(userId, fn) {
  await db.exec(`reset role; set role ${userId ? "authenticated" : "anon"};`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

async function expectError(name, fn, pattern) {
  try {
    await fn();
    check(name, false, "expected an error, got success");
  } catch (e) {
    const msg = String(e.message ?? e);
    check(name, pattern ? new RegExp(pattern).test(msg) : true, msg);
  }
}

const q = (sql, params) => db.query(sql, params).then((r) => r.rows);

await db.exec(SUPABASE_STUBS);
const dir = path.join(root, "supabase/migrations");
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(path.join(dir, f), "utf8"));
  console.log(`applied ${f}`);
}

const FARMER = "11111111-1111-1111-1111-111111111111";
const BUYER = "22222222-2222-2222-2222-222222222222";
const BUYER2 = "33333333-3333-3333-3333-333333333333";
const FARMER2 = "44444444-4444-4444-4444-444444444444";

console.log("\nsign-up trigger");
await q(`insert into auth.users (id, email, raw_user_meta_data) values
  ($1, 'farmer@test', '{"role":"farmer","full_name":"Ramesh Patil","preferred_lang":"hi"}'),
  ($2, 'buyer@test', '{"role":"consumer","consumer_type":"industrial","full_name":"Anita Rao"}'),
  ($3, 'buyer2@test', '{"full_name":"Sam"}'),
  ($4, 'farmer2@test', '{"role":"farmer","full_name":"Gurpreet Singh"}')`, [FARMER, BUYER, BUYER2, FARMER2]);
const profiles = await q(`select id, role, consumer_type, preferred_lang from public.profiles order by id`);
check("profiles created for every user", profiles.length === 4);
check("farmer role from metadata", profiles.find((p) => p.id === FARMER)?.role === "farmer");
check("industrial buyer type kept", profiles.find((p) => p.id === BUYER)?.consumer_type === "industrial");
check("missing role defaults to individual buyer", profiles.find((p) => p.id === BUYER2)?.consumer_type === "individual");
check("details rows created", (await q(`select count(*)::int c from public.farmer_details`))[0].c === 2 && (await q(`select count(*)::int c from public.buyer_details`))[0].c === 2);

console.log("\nonboarding");
const addr = (lat, lng, district) =>
  `insert into public.addresses (label, line1, village_city, district, state, pincode, lat, lng) values ('farm','Plot 4','Junnar','${district}','Maharashtra','410502',${lat},${lng})`;
await as(FARMER, async () => {
  await q(`update public.profiles set phone = '9876543210', onboarded = true where id = auth.uid()`);
  await q(`update public.farmer_details set farm_name = 'Patil Farm', main_crops = '{Tomato,Onion}' where user_id = auth.uid()`);
  await q(addr(19.20512, 73.87456, "Pune"));
});
await as(FARMER2, async () => {
  await q(`update public.profiles set phone = '9811111111', onboarded = true where id = auth.uid()`);
  await q(addr(19.11, 73.97, "Pune"));
});
// Buyers live in Narayangaon, about 15 km from the farm: inside every delivery limit.
for (const b of [BUYER, BUYER2]) {
  await as(b, async () => {
    await q(`update public.profiles set phone = '9000000000', onboarded = true where id = auth.uid()`);
    await q(addr(19.115, 73.975, "Pune"));
  });
}
await expectError("a user cannot change their own role", () => as(BUYER, () => q(`update public.profiles set role = 'farmer' where id = auth.uid()`)), "permission denied");
check("a user cannot read someone else's profile", (await as(BUYER, () => q(`select * from public.profiles where id = $1`, [FARMER]))).length === 0);

console.log("\nlisting produce");
const tomato = await as(FARMER, async () =>
  (await q(`insert into public.produce (item_id, category, name, unit, price_per_unit, qty_listed, min_order_qty) values ('tomato','vegetables','Tomato','kg',32,10,1) returning *`))[0],
);
check("listing created as active with 10 kg available", tomato.status === "active" && Number(tomato.qty_available) === 10);
check("listing copies the farm's district", tomato.district === "Pune");
check("ledger records the listing", (await as(FARMER, () => q(`select * from public.produce_log where produce_id = $1`, [tomato.id])))[0]?.change_type === "listed");
await expectError("buyers cannot list produce", () => as(BUYER, () => q(`insert into public.produce (item_id, category, name, unit, price_per_unit, qty_listed) values ('mango','fruits','Mango','kg',90,5)`)), "only_farmers_can_list");
await expectError("farmers cannot edit stock counters directly", () => as(FARMER, () => q(`update public.produce set qty_sold = 5 where id = $1`, [tomato.id])), "permission denied");
await expectError("farmers cannot set their own farmer_id on insert", () => as(FARMER, () => q(`insert into public.produce (farmer_id, item_id, category, name, unit, price_per_unit, qty_listed) values ($1,'mango','fruits','Mango','kg',90,5)`, [FARMER2])), "permission denied");
const buyerEdit = await as(BUYER, () => q(`update public.produce set price_per_unit = 1 where id = $1 returning id`, [tomato.id]));
check("buyers cannot edit a farmer's listing", buyerEdit.length === 0);

console.log("\nmarket");
const anonMarket = await as(null, () => q(`select * from public.market_listings`));
check("visitors see the listing on the market", anonMarket.length === 1 && anonMarket[0].farmer_name === "Ramesh Patil");
check("market hides precise coordinates", anonMarket[0].approx_lat === 19.21);
check("market exposes no phone column", !("phone" in anonMarket[0]) && !("farmer_phone" in anonMarket[0]));
await expectError("visitors cannot read open demand", () => as(null, () => q(`select * from public.open_demand`)), "permission denied");
await expectError("visitors cannot place orders", () => as(null, () => q(`select public.place_order('[]'::jsonb, '{}'::jsonb)`)), "permission denied");

console.log("\nordering");
const delivery = JSON.stringify({ name: "Anita Rao", phone: "9000000000", line1: "12 MG Road", village_city: "Narayangaon", district: "Pune", state: "Maharashtra", pincode: "410504", lat: 19.115, lng: 73.975, notes: "Gate 2" });
const placed = await as(BUYER, () => q(`select public.place_order($1::jsonb, $2::jsonb) as r`, [JSON.stringify([{ produce_id: tomato.id, quantity: 4 }]), delivery]));
const orderId = placed[0].r.orders[0].order_id;
check("order placed with the right total", Number(placed[0].r.orders[0].total) === 128);
let t = (await q(`select * from public.produce where id = $1`, [tomato.id]))[0];
check("4 kg reserved, 6 kg still available", Number(t.qty_reserved) === 4 && Number(t.qty_available) === 6);
check("buyer sees their order", (await as(BUYER, () => q(`select * from public.orders`))).length === 1);
check("farmer sees the order with the delivery address", (await as(FARMER, () => q(`select delivery_line1 from public.orders`)))[0]?.delivery_line1 === "12 MG Road");
check("another buyer cannot see it", (await as(BUYER2, () => q(`select * from public.orders`))).length === 0);
check("another farmer cannot see it", (await as(FARMER2, () => q(`select * from public.orders`))).length === 0);
check("another buyer cannot see its items", (await as(BUYER2, () => q(`select * from public.order_items`))).length === 0);
await expectError("orders cannot be inserted directly", () => as(BUYER, () => q(`insert into public.orders (checkout_id, delivery_name, delivery_phone, delivery_line1, delivery_village_city, delivery_district, delivery_state, delivery_pincode, buyer_name, farmer_name) values (gen_random_uuid(),'a','1','b','c','d','e','411001','x','y')`)), "permission denied");
await expectError("farmers cannot order", () => as(FARMER2, () => q(`select public.place_order($1::jsonb, $2::jsonb)`, [JSON.stringify([{ produce_id: tomato.id, quantity: 1 }]), delivery])), "only_buyers_can_order");
await expectError("cannot order more than is available", () => as(BUYER2, () => q(`select public.place_order($1::jsonb, $2::jsonb)`, [JSON.stringify([{ produce_id: tomato.id, quantity: 7 }]), delivery])), "insufficient_stock");
await expectError("a bad PIN code is rejected", () => as(BUYER2, () => q(`select public.place_order($1::jsonb, $2::jsonb)`, [JSON.stringify([{ produce_id: tomato.id, quantity: 1 }]), JSON.stringify({ ...JSON.parse(delivery), pincode: "12" })])), "invalid_delivery");
const failedOrders = (await q(`select count(*)::int c from public.orders`))[0].c;
check("a failed checkout leaves no partial order behind", failedOrders === 1);

console.log("\nstatus changes");
await expectError("buyers cannot accept their own order", () => as(BUYER, () => q(`select public.update_order_status($1, 'accepted')`, [orderId])), "invalid_transition");
await expectError("farmers cannot skip to delivered", () => as(FARMER, () => q(`select public.update_order_status($1, 'delivered')`, [orderId])), "invalid_transition");
await expectError("a stranger cannot touch the order", () => as(BUYER2, () => q(`select public.update_order_status($1, 'cancelled')`, [orderId])), "not_allowed");
for (const s of ["accepted", "packed", "out_for_delivery", "delivered"]) {
  await as(FARMER, () => q(`select public.update_order_status($1, $2::public.order_status)`, [orderId, s]));
}
t = (await q(`select * from public.produce where id = $1`, [tomato.id]))[0];
check("delivery moves 4 kg from reserved to sold", Number(t.qty_sold) === 4 && Number(t.qty_reserved) === 0 && Number(t.qty_available) === 6);
const hist = (await q(`select status_history from public.orders where id = $1`, [orderId]))[0].status_history;
check("status history records every step", hist.map((h) => h.status).join(",") === "placed,accepted,packed,out_for_delivery,delivered");

console.log("\ncancel and reject release stock");
const o2 = (await as(BUYER2, () => q(`select public.place_order($1::jsonb, $2::jsonb) as r`, [JSON.stringify([{ produce_id: tomato.id, quantity: 6 }]), delivery])))[0].r.orders[0].order_id;
t = (await q(`select * from public.produce where id = $1`, [tomato.id]))[0];
check("taking the last 6 kg marks the listing sold out", t.status === "sold_out" && Number(t.qty_available) === 0);
check("sold-out listings stay visible on the market", (await as(null, () => q(`select status from public.market_listings where id = $1`, [tomato.id])))[0]?.status === "sold_out");
await expectError("nobody can order a sold-out listing", () => as(BUYER, () => q(`select public.place_order($1::jsonb, $2::jsonb)`, [JSON.stringify([{ produce_id: tomato.id, quantity: 1 }]), delivery])), "unavailable");
await as(BUYER2, () => q(`select public.update_order_status($1, 'cancelled')`, [o2]));
t = (await q(`select * from public.produce where id = $1`, [tomato.id]))[0];
check("buyer cancel releases stock and reopens the listing", Number(t.qty_available) === 6 && t.status === "active");
const o3 = (await as(BUYER, () => q(`select public.place_order($1::jsonb, $2::jsonb) as r`, [JSON.stringify([{ produce_id: tomato.id, quantity: 2 }]), delivery])))[0].r.orders[0].order_id;
await as(FARMER, () => q(`select public.update_order_status($1, 'rejected')`, [o3]));
t = (await q(`select * from public.produce where id = $1`, [tomato.id]))[0];
check("farmer reject releases stock", Number(t.qty_available) === 6 && Number(t.qty_reserved) === 0);

console.log("\nmulti-farmer checkout");
const wheat = await as(FARMER2, async () => (await q(`insert into public.produce (item_id, category, name, unit, price_per_unit, qty_listed, min_order_qty) values ('wheat','grains','Wheat','quintal',2400,20,2) returning *`))[0]);
await expectError("minimum order is enforced", () => as(BUYER, () => q(`select public.place_order($1::jsonb, $2::jsonb)`, [JSON.stringify([{ produce_id: wheat.id, quantity: 1 }]), delivery])), "below_min_order");
const multi = (await as(BUYER, () => q(`select public.place_order($1::jsonb, $2::jsonb) as r`, [JSON.stringify([{ produce_id: tomato.id, quantity: 1 }, { produce_id: wheat.id, quantity: 2 }]), delivery])))[0].r;
check("one checkout with two farmers makes two orders", multi.orders.length === 2);
check("each farmer sees only their own order of the checkout", (await as(FARMER2, () => q(`select * from public.orders`))).length === 1);

console.log("\nstock log adjustments");
await as(FARMER, () => q(`select public.adjust_stock($1, 'restocked', 5, 'second picking')`, [tomato.id]));
await as(FARMER, () => q(`select public.adjust_stock($1, 'spoiled', 1, null)`, [tomato.id]));
t = (await q(`select * from public.produce where id = $1`, [tomato.id]))[0];
check("restock and spoilage update the counts", Number(t.qty_listed) === 15 && Number(t.qty_spoiled) === 1 && Number(t.qty_available) === 9);
await expectError("cannot spoil more than is unsold", () => as(FARMER, () => q(`select public.adjust_stock($1, 'spoiled', 50, null)`, [tomato.id])), "exceeds_available");
await expectError("cannot adjust someone else's stock", () => as(FARMER2, () => q(`select public.adjust_stock($1, 'restocked', 5, null)`, [tomato.id])), "not_allowed");
const log = await as(FARMER, () => q(`select change_type from public.produce_log where produce_id = $1 order by created_at`, [tomato.id]));
check("ledger has every movement", ["listed", "reserved", "sold", "reserved", "released", "reserved", "released", "reserved", "restocked", "spoiled"].every((x) => log.some((l) => l.change_type === x)));
await expectError("unit is locked once orders exist", () => as(FARMER, () => q(`update public.produce set unit = 'dozen' where id = $1`, [tomato.id])), "unit_locked");

console.log("\nreviews");
await as(BUYER, () => q(`insert into public.reviews (order_id, rating, comment) values ($1, 5, 'Fresh and on time')`, [orderId]));
const rating = (await as(null, () => q(`select farmer_rating, farmer_ratings_count from public.market_listings where id = $1`, [tomato.id])))[0];
check("rating shows on the market", rating.farmer_rating === 5 && rating.farmer_ratings_count === 1);
await expectError("only one review per order", () => as(BUYER, () => q(`insert into public.reviews (order_id, rating) values ($1, 4)`, [orderId])), "duplicate key");
await expectError("cannot review an order that was not delivered", () => as(BUYER, () => q(`insert into public.reviews (order_id, rating) values ($1, 1)`, [o3])), "cannot_review");

console.log("\ndemand");
await as(BUYER, () => q(`insert into public.demand_requests (category, item_name, quantity, unit, target_price) values ('vegetables','Onion',500,'kg',22)`));
const seen = await as(FARMER, () => q(`select * from public.open_demand`));
check("farmers see open buyer requests", seen.length === 1 && seen[0].buyer_type === "industrial" && seen[0].district === "Pune");
check("demand label hides the buyer's full name", seen[0].buyer_label === "Anita");
await expectError("farmers cannot post demand", () => as(FARMER, () => q(`insert into public.demand_requests (item_name, quantity, unit) values ('Seeds',1,'kg')`)), "only_buyers_can_post");
check("buyers cannot edit others' requests", (await as(BUYER2, () => q(`update public.demand_requests set status = 'closed' returning id`))).length === 0);

console.log("\nstorage policies");
await as(FARMER, () => q(`insert into storage.objects (bucket_id, name) values ('produce-images', $1)`, [`${FARMER}/tomato.webp`]));
check("farmer can upload into their own folder", true);
await expectError("nobody can upload into another user's folder", () => as(FARMER, () => q(`insert into storage.objects (bucket_id, name) values ('produce-images', $1)`, [`${BUYER}/x.webp`])), "row-level security");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
