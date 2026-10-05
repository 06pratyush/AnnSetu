// The order lifecycle and its effect on a listing's stock, as update_order_status, place_order,
// release_batch and adjust_stock implement them (supabase/migrations/*functions*.sql).

export const STATUSES = ["pooling", "placed", "accepted", "rejected", "packed", "out_for_delivery", "delivered", "cancelled"] as const;
export type Status = (typeof STATUSES)[number];
export type Actor = "farmer" | "buyer" | "system";

/** Every allowed move, by who makes it. */
export const MOVES: Record<Actor, readonly (readonly [Status, Status])[]> = {
  farmer: [
    ["placed", "accepted"],
    ["placed", "rejected"],
    ["accepted", "packed"],
    ["accepted", "out_for_delivery"],
    ["accepted", "cancelled"],
    ["packed", "out_for_delivery"],
    ["packed", "cancelled"],
    ["out_for_delivery", "delivered"],
  ],
  buyer: [
    ["pooling", "cancelled"],
    ["placed", "cancelled"],
    ["accepted", "cancelled"],
  ],
  // release_batch: a shared trip goes to the farmer.
  system: [["pooling", "placed"]],
};

export const allowed = (from: Status, to: Status, actor: Actor) => MOVES[actor].some(([a, b]) => a === from && b === to);

/** Statuses whose order still holds its quantity in qty_reserved. */
export const HOLDING: readonly Status[] = ["pooling", "placed", "accepted", "packed", "out_for_delivery"];
/** Finished: the reservation was turned into a sale or given back. */
export const FINISHED: readonly Status[] = ["rejected", "delivered", "cancelled"];

/** A listing's four counters; available = listed − sold − reserved − spoiled. */
export interface Stock {
  listed: number;
  sold: number;
  reserved: number;
  spoiled: number;
}
export const available = (s: Stock) => s.listed - s.sold - s.reserved - s.spoiled;

/** One move of one order holding q of this listing, as the database applies it. */
export function applyMove(s: Stock, to: Status, q: number): Stock {
  if (to === "delivered") return { ...s, reserved: Math.max(s.reserved - q, 0), sold: s.sold + q };
  if (to === "rejected" || to === "cancelled") return { ...s, reserved: Math.max(s.reserved - q, 0) };
  return s;
}

/** adjust_stock: null when the database refuses it. */
export function applyAdjust(s: Stock, type: "restocked" | "spoiled" | "adjusted", q: number): Stock | null {
  if (q === 0) return null;
  if (type === "restocked") return q < 0 ? null : { ...s, listed: s.listed + q };
  if (type === "spoiled") return q < 0 || q > available(s) ? null : { ...s, spoiled: s.spoiled + q };
  return available(s) + q < 0 ? null : { ...s, listed: s.listed + q };
}
