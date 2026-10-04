import * as React from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("text-small font-semibold text-ink", className)} {...props} />;
}

type FieldProps = {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  optional?: string;
  className?: string;
  children: React.ReactElement<Record<string, unknown>>;
};

/**
 * Label above, control, then hint or error. Wires id, aria-describedby and aria-invalid into
 * the single child control so screen readers announce the hint and the error with it.
 */
export function Field({ id, label, hint, error, optional, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  const control = React.cloneElement(children, {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
  });
  return (
    <div data-slot="field" className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="ml-1 font-normal text-ink-muted">({optional})</span> : null}
      </Label>
      {control}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-small text-danger" role="alert">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-small text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A group of fields with a heading, used to split long forms into readable chunks. */
export function FieldSet({
  legend,
  description,
  children,
  className,
}: {
  legend: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-4", className)}>
      <legend className="mb-1 font-display text-h3 font-semibold text-ink">{legend}</legend>
      {description ? <p className="-mt-2 text-small text-ink-muted">{description}</p> : null}
      {children}
    </fieldset>
  );
}
