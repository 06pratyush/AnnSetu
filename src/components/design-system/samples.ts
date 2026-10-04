// Example data for the living style guide and the design-system previews. Never shown as real records.
import type { CartLine, FarmerPublic, LedgerEntry, MarketListing, OpenDemand, Order, Produce } from "@/lib/types";

const now = Date.now();
const ago = (h: number) => new Date(now - h * 3600_000).toISOString();

export const sampleProduce: Produce = {
  id: "00000000-0000-0000-0000-00000000a001",
  farmer_id: "farmer-1",
  category: "vegetables",
  name: "Tomato",
  variety: "Desi",
  description: "Hand-picked this morning. Packed in 10 kg crates.",
  unit: "kg",
  price_per_unit: 32,
  qty_listed: 100,
  qty_sold: 62,
  qty_reserved: 14,
  qty_spoiled: 0,
  qty_available: 24,
  min_order_qty: 5,
  harvest_date: new Date(now - 86400_000).toISOString().slice(0, 10),
  best_before: new Date(now + 5 * 86400_000).toISOString().slice(0, 10),
  is_organic: true,
  images: [],
  status: "active",
  district: "Pune",
  state: "Maharashtra",
  created_at: ago(30),
  updated_at: ago(2),
};

export const sampleProduce2: Produce = {
  ...sampleProduce,
  id: "00000000-0000-0000-0000-00000000a002",
  category: "grains",
  name: "Wheat",
  variety: "Sharbati",
  unit: "quintal",
  price_per_unit: 2650,
  qty_listed: 40,
  qty_sold: 12,
  qty_reserved: 4,
  qty_spoiled: 1,
  qty_available: 23,
  min_order_qty: 2,
  is_organic: false,
};

export const sampleListing: MarketListing = {
  id: sampleProduce.id,
  farmer_id: "farmer-1",
  category: "vegetables",
  name: "Tomato",
  variety: "Desi",
  description: sampleProduce.description,
  unit: "kg",
  price_per_unit: 32,
  qty_available: 24,
  min_order_qty: 5,
  harvest_date: sampleProduce.harvest_date,
  best_before: sampleProduce.best_before,
  is_organic: true,
  images: [],
  status: "active",
  district: "Pune",
  state: "Maharashtra",
  approx_lat: 19.21,
  approx_lng: 73.87,
  created_at: ago(30),
  farmer_name: "Ramesh Patil",
  farm_name: "Patil Farm",
  farmer_avatar: null,
  farmer_rating: 4.6,
  farmer_ratings_count: 18,
};

export const sampleFarmer: FarmerPublic = {
  id: "farmer-1",
  full_name: "Ramesh Patil",
  avatar_url: null,
  farm_name: "Patil Farm",
  farm_size_acres: 6.5,
  main_crops: ["Tomato", "Onion", "Wheat"],
  district: "Pune",
  state: "Maharashtra",
  avg_rating: 4.6,
  ratings_count: 18,
  member_since: "2026-03-14T00:00:00Z",
};

export const sampleOrder: Order = {
  id: "7f3a9c21-0000-0000-0000-000000000001",
  checkout_id: "c1",
  buyer_id: "buyer-1",
  farmer_id: "farmer-1",
  status: "placed",
  payment_method: "cod",
  total: 2240,
  delivery_name: "Anita Rao",
  delivery_phone: "9000000000",
  delivery_line1: "12 MG Road",
  delivery_line2: "Near City Bank",
  delivery_village_city: "Pune",
  delivery_district: "Pune",
  delivery_state: "Maharashtra",
  delivery_pincode: "411001",
  delivery_lat: 18.52,
  delivery_lng: 73.85,
  delivery_notes: "Gate 2, before 10 am",
  buyer_name: "Anita Rao",
  buyer_type: "industrial",
  farmer_name: "Ramesh Patil",
  farmer_phone: "9876543210",
  status_history: [{ status: "placed", at: ago(1), by: "buyer" }],
  created_at: ago(1),
  updated_at: ago(1),
  order_items: [
    { id: "i1", order_id: "o1", produce_id: sampleProduce.id, name: "Tomato", unit: "kg", unit_price: 32, quantity: 20 },
    { id: "i2", order_id: "o1", produce_id: "p2", name: "Onion", unit: "kg", unit_price: 24, quantity: 60 },
  ],
};

export const sampleOrderInTransit: Order = {
  ...sampleOrder,
  id: "7f3a9c21-0000-0000-0000-000000000002",
  status: "out_for_delivery",
  status_history: [
    { status: "placed", at: ago(26), by: "buyer" },
    { status: "accepted", at: ago(25), by: "farmer" },
    { status: "packed", at: ago(6), by: "farmer" },
    { status: "out_for_delivery", at: ago(1), by: "farmer" },
  ],
};

export const sampleDemand: OpenDemand = {
  id: "d1",
  buyer_id: "buyer-1",
  category: "vegetables",
  item_name: "Onion",
  quantity: 500,
  unit: "kg",
  target_price: 22,
  needed_by: new Date(now + 6 * 86400_000).toISOString().slice(0, 10),
  notes: "Medium size, dry, packed in 50 kg bags. Weekly supply.",
  district: "Pune",
  state: "Maharashtra",
  status: "open",
  created_at: ago(5),
  buyer_type: "industrial",
  buyer_label: "Hotel Shreyas",
  approx_lat: 18.52,
  approx_lng: 73.85,
};

export const sampleLedger: LedgerEntry[] = [
  { id: "l5", produce_id: sampleProduce.id, change_type: "sold", quantity: 20, note: null, order_id: sampleOrder.id, created_at: ago(2) },
  { id: "l4", produce_id: sampleProduce.id, change_type: "reserved", quantity: 14, note: null, order_id: "a81c44e0-0000", created_at: ago(5) },
  { id: "l3", produce_id: sampleProduce.id, change_type: "spoiled", quantity: 3, note: "Rain damage", order_id: null, created_at: ago(20) },
  { id: "l2", produce_id: sampleProduce.id, change_type: "restocked", quantity: 40, note: "Second picking", order_id: null, created_at: ago(28) },
  { id: "l1", produce_id: sampleProduce.id, change_type: "listed", quantity: 60, note: null, order_id: null, created_at: ago(30) },
];

export const sampleCart: CartLine[] = [
  { produceId: "p1", category: "vegetables", farmerId: "farmer-1", farmerName: "Ramesh Patil", name: "Tomato", unit: "kg", price: 32, quantity: 10, minOrder: 5, maxQty: 24, image: null },
  { produceId: "p2", category: "grains", farmerId: "farmer-2", farmerName: "Gurpreet Singh", name: "Wheat", unit: "quintal", price: 2650, quantity: 2, minOrder: 2, maxQty: 23, image: null },
];
