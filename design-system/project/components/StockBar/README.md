# StockBar

StockBar is AnnSetu's signature: one bar per listing, split into sold, reserved (in open orders) and unsold, plus spoiled when there is any.

Segments are told apart three ways, so the bar never relies on hue: lightness (`chart-1` dark, `chart-2` mid, `stock-track` light), 2px surface gaps between segments, and a named legend with quantities. Spoiled stock uses a 135° `danger` hatch. The bar is a single image to screen readers, with the full breakdown as its label.

**Provide** `name`, `unit` and the four quantities from the listing. `size="md"` shows the legend; `sm` shows a one-line summary ("62 of 100 kg sold") for rows. The fill grows in once on first view, unless reduced motion is on.

## Props

```ts
export interface StockBarProps {
  name: string;
  unit: string;
  sold: number;
  reserved: number;
  available: number;
  spoiled?: number;
  size?: "sm" | "md";
  animate?: boolean;
}
```
