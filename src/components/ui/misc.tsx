import * as React from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, LoaderCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-sm bg-sunken", className)} {...props} />;
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-ink-muted", className)}>
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      {label ? <span className="text-small">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

export function Separator({ className, ...props }: React.ComponentProps<"hr">) {
  return <hr className={cn("border-0 border-t border-border", className)} {...props} />;
}

const alertVariants = cva("flex items-start gap-3 rounded-md px-4 py-3 text-small [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0", {
  variants: {
    tone: {
      info: "bg-info-soft text-info",
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-danger",
      accent: "bg-haldi-soft text-haldi-ink",
    },
  },
  defaultVariants: { tone: "info" },
});

const alertIcons = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert, accent: Info };

/** Inline message. Text stays in the status color, which meets 4.5:1 on its soft ground. */
export function Alert({
  tone = "info",
  title,
  children,
  className,
  action,
}: VariantProps<typeof alertVariants> & {
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const Icon = alertIcons[tone ?? "info"];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn(alertVariants({ tone }), className)}>
      <Icon aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-ink">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function Progress({ value, max = 100, label, className }: { value: number; max?: number; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-role-soft", className)}
    >
      <div className="h-full rounded-full bg-role transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
