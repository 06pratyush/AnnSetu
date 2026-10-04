# Alert

Alert is an inline message about the current screen: success, warning, danger, info, or accent (haldi) for demand context.

Write it as what happened and what to do next, without apologies ("Couldn't look up the address. Type it in below."). Danger alerts are announced as alerts; the others politely.

## Props

```ts
export interface AlertProps { tone?: "info" | "success" | "warning" | "danger" | "accent"; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }
```
