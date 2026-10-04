# HiddenNote

HiddenNote says what the hard rules removed and why ("2 too far, 1 wouldn't arrive fresh"), so a short or empty list explains itself instead of looking broken. Counts come from `match_hidden`, which reports the first rule each hidden listing breaks.

## Props

```ts
export type HiddenReason = "unverified" | "no_location" | "too_far" | "below_min_order" | "not_enough_stock" | "not_fresh_on_arrival" | "hidden_in_area";
export interface HiddenNoteProps { hidden: { reason: HiddenReason; listings: number }[] }
```
