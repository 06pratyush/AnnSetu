# BatchProgress

BatchProgress shows a shared household trip filling up. Household orders to one farm and one PIN code wait in a batch; the bar is the households' combined saving against the shop price, measured against the trip cost.

The trip goes to the farmer when the savings cover it (every household then pays less than the shop, delivery included) or at the cut-off, 24 hours after the first order. A trip sent at the cut-off is marked below break-even and the farmer decides whether to make it.

## Props

```ts
export interface BatchProgressProps {
  batch: { room: number; trip_cost: number; load_qty: number; cutoff_at: string; status: "open" | "released" | "accepted" | "rejected" | "delivered" | "cancelled"; below_break_even: boolean };
}
```
