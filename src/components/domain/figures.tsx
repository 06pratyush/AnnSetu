"use client";

import { Minus, Plus, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormat } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { UNITS, type Unit } from "@/lib/types";
import { NativeSelect } from "@/components/ui/input";

/**
 * Stat tile: label, value, optional hint. Values use the display sans with proportional figures
 * (tabular figures are only for columns).
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  attention,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  /** Marks a figure that needs action, e.g. new orders waiting. */
  attention?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-md border border-border bg-surface p-4", className)}>
      <p className="flex items-center gap-2 text-small font-medium text-ink-muted">
        {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
        <span className="truncate">{label}</span>
        {attention ? <span className="ml-auto size-2.5 shrink-0 rounded-full bg-haldi" aria-hidden /> : null}
      </p>
      <p className="font-display text-kpi font-semibold text-ink wdth-condensed">{value}</p>
      {hint ? <p className="text-small text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/** "₹32/kg": the amount leads, the unit follows quietly. */
export function PriceTag({ price, unit, size = "md", className }: { price: number; unit: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const f = useFormat();
  return (
    <span className={cn("inline-flex items-baseline gap-0.5 whitespace-nowrap", className)}>
      <span
        className={cn(
          "font-display font-semibold text-ink",
          size === "sm" && "text-body",
          size === "md" && "text-h3",
          size === "lg" && "text-h1",
        )}
      >
        {f.money(price)}
      </span>
      <span className={cn("text-ink-muted", size === "lg" ? "text-body" : "text-small")}>/{f.unit(unit)}</span>
    </span>
  );
}

/** Unit-aware quantity control with big +/- targets. Clamps to [min, max]. */
export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  unit,
  label,
  id,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit: string;
  label: string;
  id?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const clamp = (v: number) => {
    let n = Number.isFinite(v) ? v : min;
    if (max !== undefined) n = Math.min(n, max);
    return Math.max(min, Math.round(n * 100) / 100);
  };
  return (
    <div className={cn("inline-flex h-12 items-stretch overflow-hidden rounded-md border border-border-strong bg-surface", className)}>
      <button
        type="button"
        className="flex w-12 items-center justify-center text-ink hover:bg-sunken disabled:opacity-40"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label={t("cart.decrease")}
      >
        <Minus className="size-5" aria-hidden />
      </button>
      <label className="flex items-center border-x border-border">
        <span className="sr-only">{label}</span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step="any"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? min : Number(e.target.value))}
          onBlur={(e) => onChange(clamp(Number(e.target.value)))}
          className="h-full w-16 bg-transparent text-center text-body font-semibold text-ink tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="pr-3 text-small text-ink-muted">{f.unit(unit)}</span>
      </label>
      <button
        type="button"
        className="flex w-12 items-center justify-center text-ink hover:bg-sunken disabled:opacity-40"
        onClick={() => onChange(clamp(value + step))}
        disabled={max !== undefined && value >= max}
        aria-label={t("cart.increase")}
      >
        <Plus className="size-5" aria-hidden />
      </button>
    </div>
  );
}

export function UnitSelect(props: Omit<React.ComponentProps<typeof NativeSelect>, "children"> & { value?: Unit }) {
  const { t } = useTranslation();
  return (
    <NativeSelect {...props}>
      {UNITS.map((u) => (
        <option key={u} value={u}>
          {t(`unitsLong.${u}`)}
        </option>
      ))}
    </NativeSelect>
  );
}
