# RatingStars

RatingStars shows a farmer's average rating, or with `onChange` lets a buyer rate a delivered order from 1 to 5.

Filled stars are `haldi` with a `haldi-ink` outline; empty ones `border-strong`. The number is always printed next to the stars (or read out), so the rating never depends on counting icons. Input stars are 48px radio buttons.

## Props

```ts
export interface RatingStarsProps { value: number | null; onChange?(v: number): void; count?: number; size?: "sm" | "md" }
```
