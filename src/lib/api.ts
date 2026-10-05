// Thin data layer over Supabase. Every call runs as the signed-in user and is checked by
// row-level security; writes that touch stock or orders go through the Postgres functions.
import { isDemo, STORAGE_BUCKETS, supabase } from "./supabase";
import type { CatalogueItem } from "./matching/search";
import type {
  Address,
  AddressInput,
  BuyerDetails,
  CategorySlug,
  DeliveryBatch,
  DeliveryQuote,
  DemandRequest,
  FarmerDemand,
  HiddenReason,
  MatchRow,
  DemandStatus,
  FarmerDetails,
  FarmerPublic,
  LedgerEntry,
  LedgerType,
  MarketListing,
  OpenDemand,
  Order,
  OrderStatus,
  Produce,
  ProduceStatus,
  Profile,
  Review,
  Unit,
} from "./types";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public detail?: string,
    public hint?: string,
  ) {
    super(message);
  }
}

type PgError = { message: string; details?: string | null; hint?: string | null; code?: string } | null;

function raise(error: PgError): never {
  const msg = error?.message ?? "unknown";
  // Our functions raise short codes like "insufficient_stock" as the message.
  const code = /^[a-z_]+$/.test(msg) ? msg : (error?.code ?? "unknown");
  throw new ApiError(code, msg, error?.details ?? undefined, error?.hint ?? undefined);
}

function must<T>(res: { data: T | null; error: PgError }): T {
  if (res.error) raise(res.error);
  return res.data as T;
}

const num = (v: unknown) => (v === null || v === undefined ? v : Number(v));

function normalizeProduce<T extends Partial<Produce>>(p: T): T {
  return {
    ...p,
    price_per_unit: num(p.price_per_unit),
    qty_listed: num(p.qty_listed),
    qty_sold: num(p.qty_sold),
    qty_reserved: num(p.qty_reserved),
    qty_spoiled: num(p.qty_spoiled),
    qty_available: num(p.qty_available),
    min_order_qty: num(p.min_order_qty),
  } as T;
}

function normalizeOrder(o: Order): Order {
  const batch = Array.isArray(o.batch) ? (o.batch[0] ?? null) : (o.batch ?? null);
  return {
    ...o,
    total: Number(o.total),
    delivery_fee: Number(o.delivery_fee ?? 0),
    distance_km: num(o.distance_km) as number | null,
    batch: batch ? { ...batch, trip_cost: Number(batch.trip_cost), load_qty: Number(batch.load_qty), room: Number(batch.room) } : null,
    order_items: (o.order_items ?? []).map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
    review: Array.isArray(o.review) ? (o.review[0] ?? null) : (o.review ?? null),
  };
}

/* ------------------------------------------------------------------ profile & onboarding */

export async function updateProfile(userId: string, patch: Partial<Pick<Profile, "full_name" | "phone" | "avatar_url" | "preferred_lang" | "onboarded">>) {
  must(await supabase.from("profiles").update(patch).eq("id", userId));
}

export async function saveFarmerDetails(userId: string, d: Pick<FarmerDetails, "farm_name" | "farm_size_acres" | "main_crops" | "delivery_radius_km">) {
  must(await supabase.from("farmer_details").upsert({ user_id: userId, ...d }, { onConflict: "user_id" }));
}

export async function saveBuyerDetails(userId: string, d: Omit<BuyerDetails, "user_id">) {
  must(await supabase.from("buyer_details").upsert({ user_id: userId, ...d }, { onConflict: "user_id" }));
}

export async function getDefaultAddress(userId: string): Promise<Address | null> {
  return must(await supabase.from("addresses").select("*").eq("user_id", userId).eq("is_default", true).maybeSingle());
}

/** Updates the default address in place, or creates it. */
export async function saveDefaultAddress(userId: string, a: AddressInput): Promise<Address> {
  const existing = await getDefaultAddress(userId);
  const row = {
    label: a.label || "home",
    line1: a.line1.trim(),
    line2: a.line2?.trim() || null,
    village_city: a.village_city.trim(),
    district: a.district.trim(),
    state: a.state.trim(),
    pincode: a.pincode.trim(),
    lat: a.lat,
    lng: a.lng,
    is_default: true,
  };
  const saved: Address = existing
    ? must(await supabase.from("addresses").update(row).eq("id", existing.id).select().single())
    : must(await supabase.from("addresses").insert(row).select().single());
  // Demo mode: make sure there are a few made-up farms and buyers nearby to try things with.
  if (isDemo && a.lat !== null && a.lng !== null) {
    const { addDemoNeighbours } = await import("./demo/neighbours");
    await addDemoNeighbours({ lat: a.lat, lng: a.lng, district: row.district, state: row.state, pincode: row.pincode }).catch((err) => console.warn("demo neighbours", err));
  }
  return saved;
}

export async function uploadPhoto(bucket: keyof typeof STORAGE_BUCKETS, userId: string, file: File): Promise<string> {
  const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const b = STORAGE_BUCKETS[bucket];
  const { error } = await supabase.storage.from(b).upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });
  if (error) throw new ApiError("upload_failed", error.message);
  return supabase.storage.from(b).getPublicUrl(path).data.publicUrl;
}

/* ------------------------------------------------------------------ farmer: produce */

export async function listMyProduce(farmerId: string): Promise<Produce[]> {
  const rows = must(
    await supabase.from("produce").select("*").eq("farmer_id", farmerId).neq("status", "archived").order("created_at", { ascending: false }),
  );
  return (rows as Produce[]).map(normalizeProduce);
}

export async function getProduce(id: string): Promise<Produce | null> {
  const row = must(await supabase.from("produce").select("*").eq("id", id).maybeSingle());
  return row ? normalizeProduce(row as Produce) : null;
}

export type ProduceInput = {
  item_id: string;
  harvested_at: string;
  delivery_radius_km: number | null;
  category: CategorySlug;
  name: string;
  variety: string | null;
  description: string | null;
  unit: Unit;
  price_per_unit: number;
  qty_listed: number;
  min_order_qty: number;
  harvest_date: string | null;
  best_before: string | null;
  is_organic: boolean;
  images: string[];
};

export async function createProduce(input: ProduceInput): Promise<Produce> {
  return normalizeProduce(must(await supabase.from("produce").insert(input).select().single()) as Produce);
}

export async function updateProduce(id: string, patch: Partial<Omit<ProduceInput, "qty_listed">> & { status?: ProduceStatus }): Promise<Produce> {
  return normalizeProduce(must(await supabase.from("produce").update(patch).eq("id", id).select().single()) as Produce);
}

export async function adjustStock(produceId: string, type: Extract<LedgerType, "restocked" | "spoiled" | "adjusted">, qty: number, note?: string) {
  return must(await supabase.rpc("adjust_stock", { p_produce_id: produceId, p_type: type, p_qty: qty, p_note: note ?? null }));
}

export async function listLedger(produceId: string): Promise<LedgerEntry[]> {
  const rows = must(await supabase.from("produce_log").select("*").eq("produce_id", produceId).order("created_at", { ascending: false }).limit(200));
  return (rows as LedgerEntry[]).map((r) => ({ ...r, quantity: Number(r.quantity) }));
}

/* ------------------------------------------------------------------ market (public) */

export const MARKET_PAGE_SIZE = 24;

export type MarketQuery = {
  category: CategorySlug | "all";
  q: string;
  organic: boolean;
  sort: "newest" | "price_asc" | "price_desc";
  limit: number;
};

const cleanSearch = (s: string) => s.replace(/[%_,().*\\]/g, " ").trim().slice(0, 60);

export async function listMarket(mq: MarketQuery): Promise<{ rows: MarketListing[]; count: number }> {
  let query = supabase.from("market_listings").select("*", { count: "exact" }).eq("status", "active");
  if (mq.category !== "all") query = query.eq("category", mq.category);
  if (mq.organic) query = query.eq("is_organic", true);
  const term = cleanSearch(mq.q);
  if (term) query = query.or(`name.ilike.%${term}%,variety.ilike.%${term}%,farm_name.ilike.%${term}%,district.ilike.%${term}%`);
  if (mq.sort === "price_asc") query = query.order("price_per_unit", { ascending: true });
  else if (mq.sort === "price_desc") query = query.order("price_per_unit", { ascending: false });
  query = query.order("created_at", { ascending: false }).range(0, mq.limit - 1);
  const { data, error, count } = await query;
  if (error) raise(error);
  return { rows: (data as MarketListing[]).map(normalizeProduce), count: count ?? 0 };
}

export async function getListing(id: string): Promise<MarketListing | null> {
  const row = must(await supabase.from("market_listings").select("*").eq("id", id).maybeSingle());
  return row ? normalizeProduce(row as MarketListing) : null;
}

export async function getFarmerPublic(id: string): Promise<FarmerPublic | null> {
  const row = must(await supabase.from("farmer_public").select("*").eq("id", id).maybeSingle()) as FarmerPublic | null;
  return row ? { ...row, farm_size_acres: num(row.farm_size_acres) as number | null } : null;
}

export async function listFarmerListings(farmerId: string): Promise<MarketListing[]> {
  const rows = must(await supabase.from("market_listings").select("*").eq("farmer_id", farmerId).eq("status", "active").order("created_at", { ascending: false }));
  return (rows as MarketListing[]).map(normalizeProduce);
}

export async function listFarmerReviews(farmerId: string): Promise<Review[]> {
  return must(await supabase.from("reviews").select("*").eq("farmer_id", farmerId).order("created_at", { ascending: false }).limit(20)) as Review[];
}

/* ------------------------------------------------------------------ orders */

export type DeliveryInput = {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  village_city: string;
  district: string;
  state: string;
  pincode: string;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
};

export async function placeOrder(items: { produce_id: string; quantity: number }[], delivery: DeliveryInput) {
  return must(await supabase.rpc("place_order", { p_items: items, p_delivery: delivery })) as {
    checkout_id: string;
    orders: { order_id: string; farmer_id: string; total: number; status: string; delivery_fee: number }[];
  };
}

const ORDER_SELECT = "*, order_items(*), review:reviews(*), batch:delivery_batches(*)";

/** Batches whose collection window has closed are released lazily on every order list fetch too. */
async function releaseDueBatches() {
  const { error } = await supabase.rpc("release_due_batches");
  if (error) console.warn("release_due_batches", error.message);
}

export async function listFarmerOrders(farmerId: string): Promise<Order[]> {
  await releaseDueBatches();
  const rows = must(await supabase.from("orders").select(ORDER_SELECT).eq("farmer_id", farmerId).order("created_at", { ascending: false }).limit(200));
  return (rows as Order[]).map(normalizeOrder);
}

export async function listBuyerOrders(buyerId: string): Promise<Order[]> {
  await releaseDueBatches();
  const rows = must(await supabase.from("orders").select(ORDER_SELECT).eq("buyer_id", buyerId).order("created_at", { ascending: false }).limit(200));
  return (rows as Order[]).map(normalizeOrder);
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, deliverBy?: string | null) {
  return must(await supabase.rpc("update_order_status", { p_order_id: orderId, p_status: status, p_deliver_by: deliverBy ?? null }));
}

/** One action for a whole released household trip. Returns how many orders moved. */
export async function updateBatchStatus(batchId: string, status: OrderStatus, deliverBy?: string | null): Promise<number> {
  return must(await supabase.rpc("update_batch_status", { p_batch_id: batchId, p_status: status, p_deliver_by: deliverBy ?? null })) as number;
}

export async function quoteDelivery(items: { produce_id: string; quantity: number }[], at: { lat: number; lng: number; pincode: string }): Promise<DeliveryQuote[]> {
  const rows = must(await supabase.rpc("quote_delivery", { p_items: items, p_lat: at.lat, p_lng: at.lng, p_pincode: at.pincode })) as DeliveryQuote[];
  return rows.map((q) => ({
    ...q,
    distance_km: num(q.distance_km) as number | null,
    trip_cost: num(q.trip_cost) as number | null,
    batch_load: Number(q.batch_load),
    batch_room: Number(q.batch_room),
    my_load: Number(q.my_load),
    my_room: Number(q.my_room),
    fee_now: num(q.fee_now) as number | null,
    fee_max: num(q.fee_max) as number | null,
  }));
}

export async function listOpenBatches(farmerId: string): Promise<DeliveryBatch[]> {
  const rows = must(await supabase.from("delivery_batches").select("*").eq("farmer_id", farmerId).eq("status", "open").order("cutoff_at"));
  return (rows as DeliveryBatch[]).map((b) => ({ ...b, trip_cost: Number(b.trip_cost), load_qty: Number(b.load_qty), room: Number(b.room) }));
}

export async function createReview(orderId: string, rating: number, comment: string | null) {
  must(await supabase.from("reviews").insert({ order_id: orderId, rating, comment: comment?.trim() || null }));
}

/* ------------------------------------------------------------------ demand */

export async function listOpenDemand(): Promise<OpenDemand[]> {
  const rows = must(await supabase.from("open_demand").select("*").order("created_at", { ascending: false }).limit(100));
  return (rows as OpenDemand[]).map((d) => ({ ...d, quantity: Number(d.quantity), target_price: num(d.target_price) as number | null }));
}

export async function listMyDemand(buyerId: string): Promise<DemandRequest[]> {
  const rows = must(await supabase.from("demand_requests").select("*").eq("buyer_id", buyerId).order("created_at", { ascending: false }));
  return (rows as DemandRequest[]).map((d) => ({ ...d, quantity: Number(d.quantity), target_price: num(d.target_price) as number | null }));
}

export type DemandInput = {
  item_id: string | null;
  category: CategorySlug;
  item_name: string;
  quantity: number;
  unit: Unit;
  target_price: number | null;
  needed_by: string | null;
  notes: string | null;
};

export async function createDemand(input: DemandInput) {
  must(await supabase.from("demand_requests").insert(input));
}

export async function setDemandStatus(id: string, status: DemandStatus) {
  must(await supabase.from("demand_requests").update({ status }).eq("id", id));
}

/* ------------------------------------------------------------------ matching engine */

/** The item catalogue with every spelling, for search (step 1). */
export async function getCatalogue(): Promise<CatalogueItem[]> {
  const [items, names] = await Promise.all([
    supabase.from("items").select("id, category, name_en, name_hi, base_unit, shelf_life_hours, sort").eq("active", true).order("sort"),
    supabase.from("item_names").select("item_id, name").limit(5000),
  ]);
  if (items.error) raise(items.error);
  if (names.error) raise(names.error);
  const byItem = new Map<string, string[]>();
  for (const n of names.data as { item_id: string; name: string }[]) byItem.set(n.item_id, [...(byItem.get(n.item_id) ?? []), n.name]);
  return (items.data as { id: string; category: string; name_en: string; name_hi: string; base_unit: CatalogueItem["baseUnit"]; shelf_life_hours: number }[]).map((i) => ({
    id: i.id,
    category: i.category,
    nameEn: i.name_en,
    nameHi: i.name_hi,
    baseUnit: i.base_unit,
    shelfLifeHours: i.shelf_life_hours,
    names: byItem.get(i.id) ?? [],
  }));
}

export async function getEngineSettings(): Promise<Record<string, unknown> | null> {
  return must(await supabase.from("engine_settings").select("*").maybeSingle());
}

export type MatchParams = {
  itemId: string | null;
  quantity: number | null;
  lat: number | null;
  lng: number | null;
  buyerType: "individual" | "industrial" | null;
  maxKm: number | null;
  state: string | null;
  district: string | null;
  category: CategorySlug | null;
  organic: boolean;
  limit: number;
};

const matchArgs = (m: MatchParams) => ({
  p_item_id: m.itemId,
  p_quantity: m.quantity,
  p_lat: m.lat,
  p_lng: m.lng,
  p_buyer_type: m.buyerType,
  p_max_km: m.maxKm,
  p_state: m.state,
  p_district: m.district,
});

/** Steps 2 to 4: listings that can serve this buyer, best first, built from live stock. */
export async function matchListings(m: MatchParams): Promise<MatchRow[]> {
  const rows = must(
    await supabase.rpc("match_listings", { ...matchArgs(m), p_category: m.category, p_organic: m.organic, p_limit: m.limit, p_offset: 0 }),
  ) as MatchRow[];
  return rows.map((r) => ({
    ...r,
    price_per_unit: Number(r.price_per_unit),
    qty_available: Number(r.qty_available),
    min_order_qty: Number(r.min_order_qty),
    distance_km: num(r.distance_km) as number | null,
    travel_hours: Number(r.travel_hours),
    hours_used: Number(r.hours_used),
    trip_cost: num(r.trip_cost) as number | null,
    total_count: Number(r.total_count),
  }));
}

/** How many listings of the item each hard rule hid from this buyer. */
export async function matchHidden(m: MatchParams): Promise<{ reason: HiddenReason; listings: number }[]> {
  if (!m.itemId) return [];
  const rows = must(await supabase.rpc("match_hidden", matchArgs(m))) as { reason: HiddenReason; listings: number }[];
  return rows.map((r) => ({ ...r, listings: Number(r.listings) }));
}

export type RateInputsRow = {
  mandi: number | null;
  shop: number | null;
  source: "manual" | "agmarknet" | "sample" | null;
  price_date: string | null;
  area: string | null;
  demand_qty: number;
  demand_requests: number;
  supply_qty: number;
  demand_multiplier: number;
};

export async function getRateInputs(
  itemId: string,
  at: { lat: number | null; lng: number | null; radiusKm: number; state: string | null; district: string | null },
): Promise<RateInputsRow | null> {
  const rows = must(
    await supabase.rpc("rate_inputs", { p_item_id: itemId, p_lat: at.lat, p_lng: at.lng, p_radius_km: at.radiusKm, p_state: at.state, p_district: at.district }),
  ) as RateInputsRow[];
  const r = rows[0];
  if (!r) return null;
  return {
    ...r,
    mandi: num(r.mandi) as number | null,
    shop: num(r.shop) as number | null,
    demand_qty: Number(r.demand_qty),
    demand_requests: Number(r.demand_requests),
    supply_qty: Number(r.supply_qty),
    demand_multiplier: Number(r.demand_multiplier),
  };
}

export async function listDemandForFarmer(): Promise<FarmerDemand[]> {
  const rows = must(await supabase.rpc("demand_for_farmer", { p_limit: 100 })) as FarmerDemand[];
  return rows.map((d) => ({
    ...d,
    quantity: Number(d.quantity),
    target_price: num(d.target_price) as number | null,
    distance_km: num(d.distance_km) as number | null,
    listing_available: num(d.listing_available) as number | null,
  }));
}

/* ------------------------------------------------------------------ realtime */

/** Calls back on any insert/update of orders visible to this user (RLS applies). */
export function subscribeToOrders(filter: { column: "farmer_id" | "buyer_id"; value: string }, onChange: (payload: { eventType: string; new: Partial<Order> }) => void) {
  const channel = supabase
    .channel(`orders-${filter.column}-${filter.value}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders", filter: `${filter.column}=eq.${filter.value}` },
      (payload) => onChange({ eventType: payload.eventType, new: payload.new as Partial<Order> }),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
