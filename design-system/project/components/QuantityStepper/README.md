# QuantityStepper

QuantityStepper sets an order quantity with big − and + targets and a typed value, clamped between the minimum order and the stock available.

**Provide** `value`, `onChange`, `unit`, an accessible `label`, and `min` / `max` from the listing (`min_order_qty`, `qty_available`).

**Use** it on the product page and in cart lines. Each button is 48px; the unit sits inside the field so "10" never appears without "kg".

## Props

```ts
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
```
