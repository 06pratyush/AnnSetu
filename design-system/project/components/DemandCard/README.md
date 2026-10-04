# DemandCard

DemandCard shows a buyer's open requirement to farmers: item, quantity needed, needed-by date, target price, buyer type and place, with a "List this" shortcut that opens a prefilled listing form.

The buyer is labelled by first name or business name only. A one-line `reason` slot shows text from the recommendation logic when it provides one.

## Props

```ts
export interface DemandCardProps { demand: OpenDemand; listHref?: string; reason?: string; compact?: boolean }
```
