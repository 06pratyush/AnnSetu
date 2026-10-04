"use client";

import { useTranslation } from "react-i18next";
import { useFormat } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

export type StockBarProps = {
  name: string;
  unit: string;
  sold: number;
  reserved: number;
  available: number;
  spoiled?: number;
  /** "md" shows the legend with numbers; "sm" is the compact row version with a one-line summary. */
  size?: "sm" | "md";
  animate?: boolean;
  className?: string;
};

/**
 * The signature component. One bar per listing, split into sold | reserved | unsold (| spoiled).
 * Segments are told apart by lightness and by 2px surface gaps, and every segment is named in the
 * legend or summary, so the bar never relies on color alone.
 */
export function StockBar({ name, unit, sold, reserved, available, spoiled = 0, size = "md", animate = true, className }: StockBarProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const listed = sold + reserved + available + spoiled;
  const pct = (v: number) => (listed > 0 ? (v / listed) * 100 : 0);

  const segments = [
    { key: "sold", value: sold, className: "bg-chart-1", label: t("produce.sold") },
    { key: "reserved", value: reserved, className: "bg-chart-2", label: t("produce.reserved") },
    { key: "available", value: available, className: "bg-stock-track", label: t("produce.available") },
    {
      key: "spoiled",
      value: spoiled,
      className: "bg-[repeating-linear-gradient(135deg,var(--danger)_0_2px,var(--danger-soft)_2px_6px)]",
      label: t("produce.spoiled"),
    },
  ];
  const visible = segments.filter((s) => s.value > 0);
  const summary = segments
    .filter((s) => s.value > 0 || s.key === "sold" || s.key === "available")
    .map((s) => `${s.label} ${f.qty(s.value, unit)}`)
    .join(", ");

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div
        role="img"
        aria-label={`${t("produce.stockLabel", { name })}: ${summary}. ${t("produce.listed")} ${f.qty(listed, unit)}.`}
        className={cn("flex w-full gap-[2px] overflow-hidden rounded-full bg-surface", size === "md" ? "h-4" : "h-2.5")}
      >
        {listed === 0 ? (
          <div className="h-full w-full bg-stock-track" />
        ) : (
          visible.map((s) => (
            <div
              key={s.key}
              className={cn("h-full first:rounded-l-full last:rounded-r-full", s.className, animate && "stock-seg")}
              style={{ width: `${pct(s.value)}%`, minWidth: 4 }}
            />
          ))
        )}
      </div>

      {size === "md" ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-muted">
          {segments
            .filter((s) => s.value > 0 || s.key !== "spoiled")
            .map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span aria-hidden className={cn("size-3 rounded-[3px]", s.className, s.key === "available" && "ring-1 ring-border-strong ring-inset")} />
                <span>{s.label}</span>
                <span className="font-semibold text-ink tabular-nums">{f.qty(s.value, unit)}</span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-small text-ink-muted tabular-nums">
          {t("produce.stockSummary", { sold: f.number(sold), listed: f.number(listed), unit: f.unit(unit) })}
          {reserved > 0 ? ` · ${t("produce.reserved")} ${f.number(reserved)}` : ""}
        </p>
      )}
    </div>
  );
}
