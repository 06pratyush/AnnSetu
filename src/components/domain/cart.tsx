"use client";

import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormat } from "@/lib/i18n/format";
import type { CartLine as CartLineData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProducePhoto } from "./brand";
import { QuantityStepper } from "./figures";

export function CartLine({
  line,
  onQuantity,
  onRemove,
  className,
}: {
  line: CartLineData;
  onQuantity: (q: number) => void;
  onRemove: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <li className={cn("@container min-w-0 py-4", className)}>
      <div className="flex min-w-0 flex-col gap-3 @lg:flex-row @lg:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <ProducePhoto src={line.image} category={line.category} alt="" className="w-16 shrink-0" iconClassName="size-6" />
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-body font-semibold text-ink">{line.name}</p>
          <p className="text-small text-ink-muted">{f.perUnit(line.price, line.unit)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <QuantityStepper
          value={line.quantity}
          onChange={onQuantity}
          min={line.minOrder}
          max={line.maxQty}
          unit={line.unit}
          label={t("cart.quantityOf", { name: line.name, unit: f.unit(line.unit) })}
        />
        <p className="w-24 text-right font-semibold text-ink tabular-nums">{f.money(line.price * line.quantity)}</p>
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`${t("common.remove")}: ${line.name}`}>
          <Trash2 />
        </Button>
      </div>
      </div>
    </li>
  );
}

/** Totals per farmer and overall. A cart with N farmers becomes N orders, and it says so. */
export function CartSummary({
  lines,
  action,
  className,
}: {
  lines: CartLineData[];
  action?: React.ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const byFarmer = new Map<string, { name: string; total: number }>();
  for (const l of lines) {
    const g = byFarmer.get(l.farmerId) ?? { name: l.farmerName, total: 0 };
    g.total += l.price * l.quantity;
    byFarmer.set(l.farmerId, g);
  }
  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  return (
    <section className={cn("flex flex-col gap-4 rounded-md border border-border bg-surface p-4 sm:p-6", className)} aria-label={t("checkout.summary")}>
      <h2 className="font-display text-h2 font-semibold text-ink">{t("checkout.summary")}</h2>
      <ul className="flex flex-col gap-2">
        {[...byFarmer.entries()].map(([id, g]) => (
          <li key={id} className="flex items-baseline justify-between gap-3 text-body">
            <span className="min-w-0 truncate text-ink">{t("cart.from", { name: g.name })}</span>
            <span className="text-ink tabular-nums">{f.money(g.total)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
        <span className="text-body font-semibold text-ink">{t("common.total")}</span>
        <span className="font-display text-h1 font-semibold text-ink tabular-nums">{f.money(total)}</span>
      </div>
      <p className="text-small text-ink-muted">{t("cart.splitNote", { count: byFarmer.size })}</p>
      {action}
    </section>
  );
}
