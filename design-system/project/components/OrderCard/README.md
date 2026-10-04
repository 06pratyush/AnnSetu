# OrderCard

OrderCard is one order as either side sees it: the other party, items with line totals, the total and "Cash on delivery", the delivery address (farmer side) and the contact number, then the next step.

New orders get a `haldi` outline. The farmer's next step is the primary button (Accept, Mark packed, Send for delivery, Mark delivered); Reject and Cancel are secondary and confirm first. These buttons mirror exactly the moves the database allows.

## Props

```ts
export interface OrderCardProps { order: Order; perspective: "farmer" | "buyer"; onAction?(s: OrderStatus): void; busyStatus?: OrderStatus | null; footer?: React.ReactNode }
```
