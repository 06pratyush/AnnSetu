# Field

Field puts a label above one control, then its hint or its error, and wires them together for screen readers.

**Provide** an `id`, a `label` and exactly one control as the child (`Input`, `UnitInput`, `NativeSelect`, `Textarea`, `ChipInput`). Field injects `id`, `aria-describedby` and `aria-invalid` into it.

**Errors** replace the hint, are written as what to do ("Enter a 10-digit mobile number."), and turn the control's border `danger` on `danger-soft`. Mark optional fields with `optional` instead of starring required ones.

**Controls**: `Input` and `NativeSelect` are 48px tall with `border-strong` outlines. Use `NativeSelect` rather than a custom dropdown: the phone's own picker is easiest on low-end Android. `UnitInput` shows the unit (`kg`, `₹/kg`) as a fixed suffix.

## Props

```ts
export interface FieldProps {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** Replaces the hint and marks the control invalid. */
  error?: string;
  /** Text for the "(optional)" marker. */
  optional?: string;
  className?: string;
  children: React.ReactElement;
}
export interface UnitInputProps extends React.InputHTMLAttributes<HTMLInputElement> { unit: string }
```
