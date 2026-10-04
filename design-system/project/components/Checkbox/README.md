# Checkbox

Checkbox is a yes/no choice with its label and an optional description; the whole row is the 48px target.

**Provide** an `id`, a `label`, and `checked` / `onCheckedChange` (or `defaultChecked`). The checked box fills with `role`.

**Use** Switch instead when the change applies immediately (a filter), Checkbox inside forms that save.

## Props

```ts
export interface CheckboxProps {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?(checked: boolean | "indeterminate"): void;
}
```
