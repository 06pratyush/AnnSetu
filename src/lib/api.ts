// Thin data layer over Supabase. Every call runs as the signed-in user and is checked by
// row-level security; writes that touch stock or orders go through the Postgres functions.
import { STORAGE_BUCKETS, supabase } from "./supabase";
import type {
  Address,
  AddressInput,
  BuyerDetails,
  CategorySlug,
  DemandRequest,
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
  return {
    ...o,
    total: Number(o.total),
    order_items: (o.order_items ?? []).map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
    review: Array.isArray(o.review) ? (o.review[0] ?? null) : (o.review ?? null),
  };
}

/* ------------------------------------------------------------------ profile & onboarding */

export async function updateProfile(userId: string, patch: Partial<Pick<Profile, "full_name" | "phone" | "avatar_url" | "preferred_lang" | "onboarded">>) {
  must(await supabase.from("profiles").update(patch).eq("id", userId));
}

export async function saveFarmerDetails(userId: string, d: Omit<FarmerDetails, "user_id">) {
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
  if (existing) return must(await supabase.from("addresses").update(row).eq("id", existing.id).select().single());
  return must(await supabase.from("addresses").insert(row).select().single());
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
    orders: { order_id: string; farmer_id: string; total: number }[];
  };
}

const ORDER_SELECT = "*, order_items(*), review:reviews(*)";

export async function listFarmerOrders(farmerId: string): Promise<Order[]> {
  const rows = must(await supabase.from("orders").select(ORDER_SELECT).eq("farmer_id", farmerId).order("created_at", { ascending: false }).limit(200));
  return (rows as Order[]).map(normalizeOrder);
}

export async function listBuyerOrders(buyerId: string): Promise<Order[]> {
  const rows = must(await supabase.from("orders").select(ORDER_SELECT).eq("buyer_id", buyerId).order("created_at", { ascending: false }).limit(200));
  return (rows as Order[]).map(normalizeOrder);
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  return must(await supabase.rpc("update_order_status", { p_order_id: orderId, p_status: status }));
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
