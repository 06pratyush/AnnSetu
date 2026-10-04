# StatCard

StatCard is a dashboard figure: label, value, and a hint that says where the number comes from.

Values use the display face (`kpi` style: Anek 600, semi-condensed) with proportional figures; tabular figures are only for columns. Money is compact in Indian notation (₹1.2L). Set `attention` to add a `haldi` dot when the figure needs action, such as new orders waiting.

## Props

```ts
export interface StatCardProps { label: string; value: string; hint?: string; icon?: React.ComponentType<{ className?: string }>; attention?: boolean }
```
