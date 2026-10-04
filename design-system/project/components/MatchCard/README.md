# MatchCard

MatchCard is one listing that passed every hard rule (step 2) for this buyer, in the order the score put it (step 3).

It adds what the buyer needs to choose: price per unit and, when the quantity is known, the price **with delivery**; quantity available; when it was picked and how much shelf life is left on arrival; the farm's on-time record ("New farmer" before the first delivery); distance; and the trip cost (shared by households, one trip for a business).

**Why this order?** opens the five part-scores (price against the local shop, freshness on arrival, nearness, on-time record, how much of the order it fills) with the weights for this buyer type. Nothing about the buyer as a person goes into the score.

## Props

```ts
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
```
