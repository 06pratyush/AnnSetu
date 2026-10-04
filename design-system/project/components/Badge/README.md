# Badge

Badge labels a state in a few words, on a soft fill with its matching text color (`success` on `success-soft`, and so on; each pair is at least 4.5:1).

Status badges always carry an icon and a word, never color alone. `role` tone for neutral highlights of the current side, `accent` (haldi) for demand.

## Props

```ts
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "role" | "accent" | "success" | "warning" | "danger" | "info" | "outline";
}
```
