# ProduceCard

ProduceCard is one listing in the market grid, and the whole card is a single link to it.

It shows the photo (or the category icon on `sunken` when there is none), organic badge, name and variety, PriceTag, quantity available, and the farmer's name, district and rating. **Provide** a `MarketListing` and its `href`.

## Props

```ts
export interface ProduceCardProps { listing: MarketListing; href: string }
```
