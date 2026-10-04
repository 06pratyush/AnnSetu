import * as React from "react";
import { cn } from "@/lib/utils";

/** Tables scroll sideways inside their own container; the page never does. */
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto rounded-md border border-border">
      <table className={cn("w-full border-collapse text-small", className)} {...props} />
    </div>
  );
}
export function THead(props: React.ComponentProps<"thead">) {
  return <thead className="bg-sunken text-left" {...props} />;
}
export function TBody(props: React.ComponentProps<"tbody">) {
  return <tbody className="[&>tr:not(:last-child)]:border-b [&>tr]:border-border" {...props} />;
}
export function TR({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("bg-surface", className)} {...props} />;
}
export function TH({ className, ...props }: React.ComponentProps<"th">) {
  return <th scope="col" className={cn("px-3 py-2.5 text-label font-semibold whitespace-nowrap text-ink-muted", className)} {...props} />;
}
export function TD({ className, numeric, ...props }: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return <td className={cn("px-3 py-3 align-middle text-ink", numeric && "text-right tabular-nums", className)} {...props} />;
}
