# ItemPicker

ItemPicker is step 1 of the matching engine as a control: whatever the person types (English, Hindi in Latin letters or Devanagari, with typos) becomes one catalogue item.

**How it matches**: each name is scored by the better of trigram overlap and edit closeness (a swapped pair of letters counts as one typo); names scoring 0.55 or more are offered. An exact spelling ("tamatar", "टमाटर") is listed first; anything else appears under **Did you mean**, and is never applied silently.

**Provide** the catalogue `index` (`indexCatalogue(items)`), the chosen `value` and `onChange`. Inside a Field it takes the label, hint and error wiring like any input. Keyboard: arrows to move, Enter to choose, Escape to close.

**Don't** let free text through: listings and requests always carry an `item_id`, which is what lets search, matching and demand line up.

## Props

```ts
export interface CatalogueItem { id: string; category: string; nameEn: string; nameHi: string; baseUnit: "kg" | "litre" | "piece" | "dozen"; shelfLifeHours: number; names: string[] }
export interface ItemPickerProps {
  index: unknown; // indexCatalogue(SEED_CATALOGUE)
  value: CatalogueItem | null;
  onChange(item: CatalogueItem | null): void;
  id?: string;
  /** Lowest closeness offered, 0-1. Default 0.55. */
  cutoff?: number;
  placeholder?: string;
}
```
