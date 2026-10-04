import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-sm border border-border-strong bg-surface px-3 text-body text-ink transition-colors duration-150 disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-70 aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldBase, "h-12", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" rows={rows} className={cn(fieldBase, "min-h-24 py-3", className)} {...props} />;
}

/** Native select: the phone's own picker is the easiest choice UI on low-end Android. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select data-slot="select" className={cn(fieldBase, "h-12 appearance-none pr-10")} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
    </div>
  );
}

/** Number input with a fixed unit suffix, e.g. "120 | kg". */
export function UnitInput({
  unit,
  className,
  ...props
}: React.ComponentProps<"input"> & { unit: string }) {
  return (
    <div className={cn("flex h-12 items-stretch overflow-hidden rounded-sm border border-border-strong bg-surface has-[input[aria-invalid=true]]:border-danger has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus", className)}>
      <input
        type="number"
        inputMode="decimal"
        className="w-full min-w-0 bg-transparent px-3 text-body text-ink tabular-nums outline-none"
        {...props}
      />
      <span className="flex items-center border-l border-border bg-sunken px-3 text-small font-semibold text-ink-muted">{unit}</span>
    </div>
  );
}
