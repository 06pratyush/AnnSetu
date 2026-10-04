# Tabs

Tabs switch between views of one list (Active, Completed, All orders; On sale, Paused, Sold out listings). The active tab has a 3px `role` underline; counts sit in a `sunken` pill.

## Props

```ts
export interface TabsProps { value?: string; defaultValue?: string; onValueChange?(v: string): void; children: React.ReactNode }
```
