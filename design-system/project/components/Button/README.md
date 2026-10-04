# Button

Button runs one action and says exactly what it does ("Accept order", "स्टॉक जोड़ें").

**Use** `primary` for the one main action on a screen; it takes the role color (`role`: khet in the farmer area, neel in the buyer area). `secondary` for other actions, `outline` for "List this" style shortcuts, `accent` (haldi) only for ratings and demand calls, `destructive` only inside a confirm step, `ghost` for low-emphasis actions in rows.

**Sizes**: `md` is 48px, the minimum in the farmer area. Use `lg` (56px) for the primary action of a form or page, `sm` (40px) only in dense desktop rows.

**Provide** a text label, always. Icon-only buttons (`icon`, `icon-sm`) need an `aria-label`. Pass `loading` while a request runs; the button disables itself and shows a spinner.

**Don't** put two primary buttons side by side, or use color as the only difference between actions.

## Props

```ts
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "accent" | "destructive" | "link";
  size?: "sm" | "md" | "lg" | "icon" | "icon-sm";
  /** Render the child (e.g. a link) with button styling. */
  asChild?: boolean;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}
```
