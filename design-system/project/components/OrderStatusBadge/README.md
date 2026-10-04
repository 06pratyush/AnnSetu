# OrderStatusBadge

OrderStatusBadge names where an order is: New, Accepted, Packed, Out for delivery, Delivered, Rejected, Cancelled. Each pairs a tone with its own icon (Clock, CircleCheck, Package, Truck, PackageCheck, CircleX, Ban).

## Props

```ts
export type OrderStatus = "placed" | "accepted" | "rejected" | "packed" | "out_for_delivery" | "delivered" | "cancelled";
export interface OrderStatusBadgeProps { status: OrderStatus }
```
