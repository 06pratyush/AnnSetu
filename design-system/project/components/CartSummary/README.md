# CartSummary

CartSummary totals the cart per farmer and overall, and says plainly that a cart with items from N farmers becomes N separate orders. Payment is cash on delivery. **Provide** the cart `lines` and the checkout `action`.

## Props

```ts
export interface CartSummaryProps { lines: CartLine[]; action?: React.ReactNode }
```
