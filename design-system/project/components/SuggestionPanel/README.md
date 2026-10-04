# SuggestionPanel

SuggestionPanel is the farmer's "In demand" panel: open buyer requests mapped to this farm by the database (`demand_for_farmer`). Requests the farm can fill now come first, then others it can reach, nearest first; requests out of reach come last, so the farmer still sees what is wanted nearby.

**Provide** `demand` and `listHref` for each. The `haldi` dot marks the panel as the place for demand across the app.

## Props

```ts
export interface SuggestionPanelProps {
  demand: DemandCardProps["demand"][];
  listHref(d: DemandCardProps["demand"]): string | undefined;
  nameOf?(d: DemandCardProps["demand"]): string;
  seeAllHref?: string;
  limit?: number;
  loading?: boolean;
}
```
