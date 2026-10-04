# ProduceRow

ProduceRow is a farmer's own listing in "My produce": photo, status, price, a compact StockBar, "Update stock", and a menu for edit, stock log, pause and archive.

**Provide** the `Produce` row, `editHref`, `logHref`, and handlers. Archive goes through a ConfirmDialog.

## Props

```ts
export interface ProduceRowProps { produce: Produce; editHref: string; logHref: string; onUpdateStock?(): void; onSetStatus?(s: "active" | "paused" | "archived"): void }
```
