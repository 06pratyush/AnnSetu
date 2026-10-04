# Switch

Switch turns a setting on or off immediately, with no save step.

**Provide** an `aria-label` or a visible label next to it, and `checked` / `onCheckedChange`. On, it fills with `role`; off, it sits on `sunken` with a `border-strong` outline.

## Props

```ts
export interface SwitchProps { checked?: boolean; defaultChecked?: boolean; onCheckedChange?(checked: boolean): void; "aria-label"?: string }
```
