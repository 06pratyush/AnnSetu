# CategoryChips

CategoryChips is the single-choice category filter above the market: All, Vegetables, Fruits, Grains, Pulses, Spices, Dairy, Oilseeds, Others.

On phones the row scrolls sideways inside itself rather than wrapping into a wall. The selected chip fills with `role`; each category carries its lucide icon.

## Props

```ts
export type CategorySlug = "vegetables" | "fruits" | "grains" | "pulses" | "spices" | "dairy" | "oilseeds" | "others";
export interface CategoryChipsProps { value: CategorySlug | "all"; onChange(v: CategorySlug | "all"): void; className?: string }
```
