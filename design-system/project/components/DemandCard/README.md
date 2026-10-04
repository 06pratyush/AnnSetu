# DemandCard

DemandCard shows a buyer's open requirement to a farmer: item, quantity, needed-by date, target price, buyer type and place, with a "List this" shortcut that opens a prefilled listing form.

Mapped to the farm, it also says how far the buyer is and whether the farm can reach them (inside both the farm's delivery radius and the buyer's distance), and **You can fill this now** when an active listing has enough stock that would still arrive fresh. The buyer is labelled by first name or business name only.

## Props

```ts
export interface DemandCardProps {
  demand: OpenDemand & { distance_km?: number | null; can_reach?: boolean; ready?: boolean; listing_available?: number | null; listing_unit?: Unit | null };
  listHref?: string;
  /** Item name in the UI language. */
  name?: string;
  compact?: boolean;
}
```
