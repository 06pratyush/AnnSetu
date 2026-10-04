# Table

Table is the plain-numbers view behind every chart, and the layout for dense lists on desktop. It scrolls sideways inside its own container; the page never does. Numeric cells are right-aligned with tabular figures; the header row sits on `sunken`.

## Props

```ts
export interface TDProps extends React.TdHTMLAttributes<HTMLTableCellElement> { numeric?: boolean }
```
