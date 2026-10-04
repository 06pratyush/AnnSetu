// Writes each component's README.md and preview.html, plus components/index.d.ts, from components.mjs.
// Run: npm run ds:docs
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPONENTS } from "./components.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "design-system/project/components");

for (const c of COMPONENTS) {
  const d = path.join(dir, c.name);
  mkdirSync(d, { recursive: true });
  writeFileSync(path.join(d, "README.md"), `# ${c.name}\n\n${c.readme.trim()}\n\n## Props\n\n\`\`\`ts\n${c.dts}\n\`\`\`\n`);
  writeFileSync(path.join(d, "preview.html"), `<!-- @dsCard group="${c.group}" height=${c.height} -->\n${c.preview}\n`);
}

const shared = `// AnnSetu components: window.AnnSetu.<Name> (React 18). Types are documentation, not checked.
import type * as React from "react";

export type Unit = "kg" | "quintal" | "tonne" | "dozen" | "piece" | "litre" | "bunch";
export type CategorySlug = "vegetables" | "fruits" | "grains" | "pulses" | "spices" | "dairy" | "oilseeds" | "others";
export type OrderStatus = "pooling" | "placed" | "accepted" | "rejected" | "packed" | "out_for_delivery" | "delivered" | "cancelled";

export interface Produce {
  id: string; farmer_id: string; category: CategorySlug; name: string; variety: string | null; description: string | null;
  unit: Unit; price_per_unit: number; qty_listed: number; qty_sold: number; qty_reserved: number; qty_spoiled: number; qty_available: number;
  min_order_qty: number; harvest_date: string | null; best_before: string | null; is_organic: boolean; images: string[];
  status: "active" | "paused" | "sold_out" | "archived"; district: string | null; state: string | null; created_at: string; updated_at: string;
}
export interface MarketListing extends Omit<Produce, "qty_listed" | "qty_sold" | "qty_reserved" | "qty_spoiled" | "updated_at"> {
  approx_lat: number | null; approx_lng: number | null; farmer_name: string; farm_name: string | null; farmer_avatar: string | null;
  farmer_rating: number | null; farmer_ratings_count: number;
}
export interface FarmerPublic {
  id: string; full_name: string; avatar_url: string | null; farm_name: string | null; farm_size_acres: number | null; main_crops: string[];
  district: string | null; state: string | null; avg_rating: number | null; ratings_count: number; member_since: string;
}
export interface OrderItem { id: string; order_id: string; produce_id: string; name: string; unit: Unit; unit_price: number; quantity: number }
export interface Order {
  id: string; status: OrderStatus; total: number; payment_method: "cod"; buyer_name: string; farmer_name: string; farmer_phone: string | null;
  delivery_name: string; delivery_phone: string; delivery_line1: string; delivery_line2: string | null; delivery_village_city: string;
  delivery_district: string; delivery_state: string; delivery_pincode: string; delivery_notes: string | null;
  status_history: { status: OrderStatus; at: string; by: "farmer" | "buyer" }[]; created_at: string; order_items?: OrderItem[];
}
export interface OpenDemand {
  id: string; category: CategorySlug; item_name: string; quantity: number; unit: Unit; target_price: number | null; needed_by: string | null;
  notes: string | null; district: string | null; state: string | null; buyer_type: "individual" | "industrial" | null; buyer_label: string;
}
export interface CartLine {
  produceId: string; category: CategorySlug; farmerId: string; farmerName: string; name: string; unit: Unit; price: number;
  quantity: number; minOrder: number; maxQty: number; image: string | null;
}

/** Renders children in another UI language. */
export interface LangProps { lang: "en" | "hi"; children: React.ReactNode }
/** Scopes the --role tokens to one side of the bridge. */
export interface RoleScopeProps { role: "farmer" | "buyer"; children: React.ReactNode }
`;
writeFileSync(path.join(dir, "index.d.ts"), `${shared}\n${COMPONENTS.map((c) => c.dts).join("\n\n")}\n`);
console.log(`docs: ${COMPONENTS.length} components`);
