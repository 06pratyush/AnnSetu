# ChipInput

ChipInput collects short free-text tags, such as a farmer's main crops: type, press Enter or comma, remove with the chip's own button.

**Provide** `value`, `onChange` and `removeLabel(item)` for each chip's accessible name. Chips sit on `role-soft`.

## Props

```ts
export interface ChipInputProps {
  id?: string;
  value: string[];
  onChange(value: string[]): void;
  max?: number;
  removeLabel(item: string): string;
}
```
