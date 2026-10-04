# SuggestionPanel

SuggestionPanel is the farmer's "In demand" panel. It renders whatever the recommendation hook returns (`src/lib/recommend`); by default that is open buyer requests, newest first, with no ranking.

**Provide** `suggestions` and `listHref` for each. The `haldi` dot marks the panel as the place for demand across the app.

## Props

```ts
export interface Suggestion { id: string; kind: "demand"; demand?: OpenDemand; score?: number; reason?: string }
export interface SuggestionPanelProps { suggestions: Suggestion[]; listHref(s: Suggestion): string | undefined; seeAllHref?: string; limit?: number; loading?: boolean }
```
