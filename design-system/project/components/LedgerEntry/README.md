# LedgerEntry

LedgerEntry is one line of a listing's stock log: what changed, when, by how much, and the order or note behind it.

The sign shows the effect on unsold stock: listed and restocked add, reserved and spoiled subtract, released adds back, and sold has no sign (it moves stock that was already reserved). Spoiled lines use `danger` on `danger-soft`, sold lines `success`.

## Props

```ts
export interface LedgerEntryProps {
  entry: { id: string; change_type: "listed" | "restocked" | "reserved" | "released" | "sold" | "spoiled" | "adjusted"; quantity: number; note: string | null; order_id: string | null; created_at: string };
  unit: string;
}
```
