import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Every list has one: an icon, what's missing, one line of help, and one action. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-10 text-center", className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-sunken">
        <Icon className="size-7 text-ink-muted" aria-hidden />
      </span>
      <p className="font-display text-h3 font-semibold text-ink">{title}</p>
      {body ? <p className="max-w-sm text-small text-ink-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
