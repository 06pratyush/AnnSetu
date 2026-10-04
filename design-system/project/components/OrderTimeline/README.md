# OrderTimeline

OrderTimeline is the order's journey as a vertical list, with the time of each step. Reached steps fill with `role`; a rejected order ends in `danger`, a cancelled one in neutral. It is an ordered list, with the current step marked for screen readers.

## Props

```ts
export interface OrderTimelineProps { status: OrderStatus; history: { status: OrderStatus; at: string; by: "farmer" | "buyer" }[] }
```
