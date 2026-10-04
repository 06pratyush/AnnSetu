# PriceTag

PriceTag prints a price per unit: the amount leads in the display face, the unit follows quietly ("₹32/kg"). Amounts use Indian grouping (₹1,25,000). Every price on AnnSetu names its unit.

## Props

```ts
export interface PriceTagProps { price: number; unit: string; size?: "sm" | "md" | "lg" }
```
