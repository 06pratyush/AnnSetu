# CartLine

CartLine is one item in the cart: photo, name, price per unit, a QuantityStepper limited by the listing, the line total, and remove. It switches from stacked to one row when its container is wide enough.

## Props

```ts
export interface CartLineProps { line: CartLine; onQuantity(q: number): void; onRemove(): void }
```
