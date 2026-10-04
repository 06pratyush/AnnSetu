// AnnSetu components: window.AnnSetu.<Name> (React 18). Types are documentation, not checked.
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

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "accent" | "destructive" | "link";
  size?: "sm" | "md" | "lg" | "icon" | "icon-sm";
  /** Render the child (e.g. a link) with button styling. */
  asChild?: boolean;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}

export interface FieldProps {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** Replaces the hint and marks the control invalid. */
  error?: string;
  /** Text for the "(optional)" marker. */
  optional?: string;
  className?: string;
  children: React.ReactElement;
}
export interface UnitInputProps extends React.InputHTMLAttributes<HTMLInputElement> { unit: string }

export interface QuantityStepperProps {
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  unit: string;
  label: string;
  id?: string;
}

export interface CheckboxProps {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?(checked: boolean | "indeterminate"): void;
}

export interface SwitchProps { checked?: boolean; defaultChecked?: boolean; onCheckedChange?(checked: boolean): void; "aria-label"?: string }

export interface ChipInputProps {
  id?: string;
  value: string[];
  onChange(value: string[]): void;
  max?: number;
  removeLabel(item: string): string;
}

export type AccountChoice = "farmer" | "individual" | "industrial";
export interface RoleChoiceCardsProps { value: AccountChoice | null; onChange(v: AccountChoice): void; className?: string; name?: string }

export interface LanguageToggleProps { className?: string; onChange?(lang: "en" | "hi"): void }

export type CategorySlug = "vegetables" | "fruits" | "grains" | "pulses" | "spices" | "dairy" | "oilseeds" | "others";
export interface CategoryChipsProps { value: CategorySlug | "all"; onChange(v: CategorySlug | "all"): void; className?: string }

export type MarketSort = "newest" | "price_asc" | "price_desc";
export interface SearchFilterBarProps {
  query: string; onQuery(q: string): void;
  sort: MarketSort; onSort(s: MarketSort): void;
  organic: boolean; onOrganic(v: boolean): void;
}

export interface RatingStarsProps { value: number | null; onChange?(v: number): void; count?: number; size?: "sm" | "md" }

export interface PhotoItem { key: string; url: string; file?: File }
export interface PhotoUploaderProps { items: PhotoItem[]; onChange(items: PhotoItem[]): void; max?: number; disabled?: boolean }

export interface TabsProps { value?: string; defaultValue?: string; onValueChange?(v: string): void; children: React.ReactNode }

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "role" | "accent" | "success" | "warning" | "danger" | "info" | "outline";
}

export interface AlertProps { tone?: "info" | "success" | "warning" | "danger" | "accent"; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }

export interface EmptyStateProps { icon: React.ComponentType<{ className?: string }>; title: React.ReactNode; body?: React.ReactNode; action?: React.ReactNode }

export interface ConfirmDialogProps {
  open: boolean; onOpenChange(open: boolean): void;
  title: React.ReactNode; body?: React.ReactNode;
  confirmLabel: string; cancelLabel: string;
  tone?: "danger" | "primary"; loading?: boolean;
  onConfirm(): void;
}

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export interface StockBarProps {
  name: string;
  unit: string;
  sold: number;
  reserved: number;
  available: number;
  spoiled?: number;
  size?: "sm" | "md";
  animate?: boolean;
}

export interface StatCardProps { label: string; value: string; hint?: string; icon?: React.ComponentType<{ className?: string }>; attention?: boolean }

export interface PriceTagProps { price: number; unit: string; size?: "sm" | "md" | "lg" }

export interface LedgerEntryProps {
  entry: { id: string; change_type: "listed" | "restocked" | "reserved" | "released" | "sold" | "spoiled" | "adjusted"; quantity: number; note: string | null; order_id: string | null; created_at: string };
  unit: string;
}

export interface TDProps extends React.TdHTMLAttributes<HTMLTableCellElement> { numeric?: boolean }

export interface ProduceCardProps { listing: MarketListing; href: string }

export interface ProduceRowProps { produce: Produce; editHref: string; logHref: string; onUpdateStock?(): void; onSetStatus?(s: "active" | "paused" | "archived"): void }

export interface FarmerCardProps { farmer: FarmerPublic; href?: string }

export interface CartLineProps { line: CartLine; onQuantity(q: number): void; onRemove(): void }

export interface CartSummaryProps { lines: CartLine[]; action?: React.ReactNode }

export type OrderStatus = "placed" | "accepted" | "rejected" | "packed" | "out_for_delivery" | "delivered" | "cancelled";
export interface OrderStatusBadgeProps { status: OrderStatus }

export interface OrderTimelineProps { status: OrderStatus; history: { status: OrderStatus; at: string; by: "farmer" | "buyer" }[] }

export interface OrderCardProps { order: Order; perspective: "farmer" | "buyer"; onAction?(s: OrderStatus): void; busyStatus?: OrderStatus | null; footer?: React.ReactNode }

export interface CatalogueItem { id: string; category: string; nameEn: string; nameHi: string; baseUnit: "kg" | "litre" | "piece" | "dozen"; shelfLifeHours: number; names: string[] }
export interface ItemPickerProps {
  index: unknown; // indexCatalogue(SEED_CATALOGUE)
  value: CatalogueItem | null;
  onChange(item: CatalogueItem | null): void;
  id?: string;
  /** Lowest closeness offered, 0-1. Default 0.55. */
  cutoff?: number;
  placeholder?: string;
}

export interface MatchCardProps {
  row: MarketListing & { distance_km: number | null; travel_hours: number | null; hours_used: number; shelf_life_hours: number; price_base: number;
    shop_price: number | null; trip_cost: number | null; part_price: number; part_fresh: number; part_near: number; part_trust: number; part_fill: number; score: number;
    farmer_verified: boolean; orders_completed: number; orders_on_time: number; harvested_at: string };
  href: string;
  /** Item name in the UI language. */
  name: string;
  /** The buyer's wanted quantity in the listing's unit, when known. */
  quantity: number | null;
  /** Households share delivery; businesses pay one trip. */
  pooled: boolean;
  weights: { price: number; fresh: number; near: number; trust: number; fill: number };
}

export type HiddenReason = "unverified" | "no_location" | "too_far" | "below_min_order" | "not_enough_stock" | "not_fresh_on_arrival" | "hidden_in_area";
export interface HiddenNoteProps { hidden: { reason: HiddenReason; listings: number }[] }

export interface BatchProgressProps {
  batch: { room: number; trip_cost: number; load_qty: number; cutoff_at: string; status: "open" | "released" | "accepted" | "rejected" | "delivered" | "cancelled"; below_break_even: boolean };
}

export interface DemandCardProps {
  demand: OpenDemand & { distance_km?: number | null; can_reach?: boolean; ready?: boolean; listing_available?: number | null; listing_unit?: Unit | null };
  listHref?: string;
  /** Item name in the UI language. */
  name?: string;
  compact?: boolean;
}

export interface SuggestionPanelProps {
  demand: DemandCardProps["demand"][];
  listHref(d: DemandCardProps["demand"]): string | undefined;
  nameOf?(d: DemandCardProps["demand"]): string;
  seeAllHref?: string;
  limit?: number;
  loading?: boolean;
}

export interface BrandMarkProps { compact?: boolean; className?: string }

export interface CategoryIconProps { category: CategorySlug; className?: string }

export interface AvatarProps { src?: string | null; name: string; size?: number }

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}
