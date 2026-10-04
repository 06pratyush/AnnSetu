// Row shapes of the Supabase tables and views (see supabase/migrations).

export type Role = "farmer" | "consumer";
export type ConsumerType = "individual" | "industrial";
export type Unit = "kg" | "quintal" | "tonne" | "dozen" | "piece" | "litre" | "bunch";
export const UNITS: Unit[] = ["kg", "quintal", "tonne", "dozen", "piece", "litre", "bunch"];

export type CategorySlug = "vegetables" | "fruits" | "grains" | "pulses" | "spices" | "dairy" | "oilseeds" | "others";
export const CATEGORY_SLUGS: CategorySlug[] = ["vegetables", "fruits", "grains", "pulses", "spices", "dairy", "oilseeds", "others"];

export type ProduceStatus = "active" | "paused" | "sold_out" | "archived";
export type OrderStatus = "placed" | "accepted" | "rejected" | "packed" | "out_for_delivery" | "delivered" | "cancelled";
export type LedgerType = "listed" | "restocked" | "reserved" | "released" | "sold" | "spoiled" | "adjusted";
export type DemandStatus = "open" | "fulfilled" | "closed";
export type BusinessType = "restaurant" | "retailer" | "wholesaler" | "processor" | "institution" | "other";

export interface Profile {
  id: string;
  role: Role;
  consumer_type: ConsumerType | null;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  preferred_lang: "en" | "hi";
  onboarded: boolean;
  created_at: string;
}

export interface FarmerDetails {
  user_id: string;
  farm_name: string | null;
  farm_size_acres: number | null;
  main_crops: string[];
}

export interface BuyerDetails {
  user_id: string;
  business_name: string | null;
  business_type: BusinessType | null;
  gstin: string | null;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  line1: string;
  line2: string | null;
  village_city: string;
  district: string;
  state: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
}

export type AddressInput = Omit<Address, "id" | "user_id" | "is_default">;

export interface Produce {
  id: string;
  farmer_id: string;
  category: CategorySlug;
  name: string;
  variety: string | null;
  description: string | null;
  unit: Unit;
  price_per_unit: number;
  qty_listed: number;
  qty_sold: number;
  qty_reserved: number;
  qty_spoiled: number;
  qty_available: number;
  min_order_qty: number;
  harvest_date: string | null;
  best_before: string | null;
  is_organic: boolean;
  images: string[];
  status: ProduceStatus;
  district: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
}

/** public.market_listings: active produce plus the farmer's public details. */
export interface MarketListing {
  id: string;
  farmer_id: string;
  category: CategorySlug;
  name: string;
  variety: string | null;
  description: string | null;
  unit: Unit;
  price_per_unit: number;
  qty_available: number;
  min_order_qty: number;
  harvest_date: string | null;
  best_before: string | null;
  is_organic: boolean;
  images: string[];
  status: ProduceStatus;
  district: string | null;
  state: string | null;
  /** Rounded to ~1 km for privacy. */
  approx_lat: number | null;
  approx_lng: number | null;
  created_at: string;
  farmer_name: string;
  farm_name: string | null;
  farmer_avatar: string | null;
  farmer_rating: number | null;
  farmer_ratings_count: number;
}

export interface FarmerPublic {
  id: string;
  full_name: string;
  avatar_url: string | null;
  farm_name: string | null;
  farm_size_acres: number | null;
  main_crops: string[];
  district: string | null;
  state: string | null;
  avg_rating: number | null;
  ratings_count: number;
  member_since: string;
}

export interface LedgerEntry {
  id: string;
  produce_id: string;
  change_type: LedgerType;
  quantity: number;
  note: string | null;
  order_id: string | null;
  created_at: string;
}

export interface StatusEvent {
  status: OrderStatus;
  at: string;
  by: "farmer" | "buyer";
}

export interface OrderItem {
  id: string;
  order_id: string;
  produce_id: string;
  name: string;
  unit: Unit;
  unit_price: number;
  quantity: number;
}

export interface Order {
  id: string;
  checkout_id: string;
  buyer_id: string;
  farmer_id: string;
  status: OrderStatus;
  payment_method: "cod";
  total: number;
  delivery_name: string;
  delivery_phone: string;
  delivery_line1: string;
  delivery_line2: string | null;
  delivery_village_city: string;
  delivery_district: string;
  delivery_state: string;
  delivery_pincode: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_notes: string | null;
  buyer_name: string;
  buyer_type: ConsumerType | null;
  farmer_name: string;
  farmer_phone: string | null;
  status_history: StatusEvent[];
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  review?: Review | null;
}

export interface DemandRequest {
  id: string;
  buyer_id: string;
  category: CategorySlug;
  item_name: string;
  quantity: number;
  unit: Unit;
  target_price: number | null;
  needed_by: string | null;
  notes: string | null;
  district: string | null;
  state: string | null;
  status: DemandStatus;
  created_at: string;
}

/** public.open_demand: open requests with the buyer's public label. */
export interface OpenDemand extends DemandRequest {
  buyer_type: ConsumerType | null;
  buyer_label: string;
  approx_lat: number | null;
  approx_lng: number | null;
}

export interface Review {
  id: string;
  order_id: string;
  farmer_id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  created_at: string;
}

export interface CartLine {
  produceId: string;
  category: CategorySlug;
  farmerId: string;
  farmerName: string;
  name: string;
  unit: Unit;
  price: number;
  quantity: number;
  minOrder: number;
  maxQty: number;
  image: string | null;
}
