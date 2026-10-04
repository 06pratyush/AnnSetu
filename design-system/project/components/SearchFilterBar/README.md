# SearchFilterBar

SearchFilterBar is the one row of market controls: search, "Organic only", and sort (newest, price low to high, price high to low).

**Provide** each value with its setter. Keep filters in this one row above results; don't scatter them through the page.

## Props

```ts
export type MarketSort = "newest" | "price_asc" | "price_desc";
export interface SearchFilterBarProps {
  query: string; onQuery(q: string): void;
  sort: MarketSort; onSort(s: MarketSort): void;
  organic: boolean; onOrganic(v: boolean): void;
}
```
