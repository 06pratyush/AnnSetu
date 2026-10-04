"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, TriangleAlert, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getRateInputs } from "@/lib/api";
import { useFormat } from "@/lib/i18n/format";
import { tripCost } from "@/lib/matching/geo";
import { useEngineSettings } from "@/lib/matching/hooks";
import { suggestRate } from "@/lib/matching/rate";
import type { CatalogueItem } from "@/lib/matching/search";
import { unitFactor } from "@/lib/matching/units";
import type { Unit } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { UnitInput } from "@/components/ui/input";

/**
 * Step 5 for the farmer: a suggested price between what the mandi would pay and what the shop
 * charges, for a typical delivery the farmer can adjust, with every move shown.
 */
export function RateSuggestion({
  item,
  unit,
  farm,
  radiusKm,
  listedQty,
  harvestedAt,
  onUse,
  className,
}: {
  item: CatalogueItem;
  unit: Unit;
  farm: { lat: number | null; lng: number | null; state: string | null; district: string | null };
  radiusKm: number;
  /** Quantity being listed, in the selling unit. */
  listedQty: number | null;
  harvestedAt: string;
  onUse: (pricePerUnit: number) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const s = useEngineSettings();
  const now = useNow();
  const factor = unitFactor(unit, item.baseUnit) ?? 1;
  const listedBase = listedQty ? listedQty * factor : null;
  const [loadInput, setLoadInput] = useState<string>("");
  const [kmInput, setKmInput] = useState<string>("");
  const [open, setOpen] = useState(false);
  const load = Number(loadInput) > 0 ? Number(loadInput) : Math.max(1, Math.min(listedBase ?? 60, 60));
  const km = Number(kmInput) > 0 ? Number(kmInput) : Math.max(1, Math.round(radiusKm / 2));

  const inputs = useQuery({
    queryKey: ["rate-inputs", item.id, farm.lat, farm.lng, radiusKm, farm.state, farm.district],
    queryFn: () => getRateInputs(item.id, { lat: farm.lat, lng: farm.lng, radiusKm, state: farm.state, district: farm.district }),
  });

  const base = f.unit(item.baseUnit);
  if (inputs.isLoading) return <Skeleton className={cn("h-32", className)} />;
  const r = inputs.data;
  if (!r || r.mandi === null || r.shop === null) {
    return <p className={cn("rounded-md bg-sunken p-4 text-small text-ink-muted", className)}>{t("rate.noPrices")}</p>;
  }

  const hoursOld = Math.max(0, (now - new Date(harvestedAt).getTime()) / 3600_000);
  const res = suggestRate(
    {
      mandi: r.mandi,
      shop: r.shop,
      tripCost: tripCost(km, s),
      tripQty: load,
      demandQty: r.demand_qty,
      supplyQty: r.supply_qty,
      demandRequests: r.demand_requests,
      demandMultiplier: r.demand_multiplier,
      lifeLeft: Math.max(0, 1 - hoursOld / item.shelfLifeHours),
    },
    s,
  );
  const perSelling = (perBase: number) => Math.round(perBase * factor * 100) / 100;
  const label = (k: string) => t(`rate.step.${k}`);

  return (
    <section aria-labelledby="rate-title" className={cn("flex flex-col gap-4 rounded-md border border-haldi bg-haldi-soft p-4", className)}>
      <div className="flex flex-col gap-1">
        <h3 id="rate-title" className="flex items-center gap-2 text-small font-semibold text-haldi-ink">
          <Sparkles className="size-4" aria-hidden />
          {t("rate.title")}
        </h3>
        {res.ok ? (
          <p className="font-display text-h2 font-semibold text-ink">
            {f.perUnit(perSelling(res.price), unit)}
          </p>
        ) : (
          <p className="flex items-start gap-2 text-body text-ink">
            <TriangleAlert className="mt-1 size-5 shrink-0 text-warning" aria-hidden />
            {t("rate.noRoom", { load: f.number(load), unit: base, breakEven: f.number(Math.ceil(res.breakEvenQty * 10) / 10) })}
          </p>
        )}
        <p className="text-small text-ink">
          {t("rate.basis", {
            mandi: f.perUnit(r.mandi, item.baseUnit),
            shop: f.perUnit(Math.round(r.shop * 100) / 100, item.baseUnit),
            source: t(`rate.source.${r.source ?? "sample"}`),
            area: r.area ?? "India",
          })}
        </p>
        {r.source === "sample" ? <p className="text-small font-semibold text-haldi-ink">{t("rate.sampleWarning")}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-small font-semibold text-ink">
          {t("rate.load")}
          <UnitInput unit={base} value={loadInput} placeholder={String(load)} onChange={(e) => setLoadInput(e.target.value)} min={0} step="any" />
        </label>
        <label className="flex flex-col gap-1 text-small font-semibold text-ink">
          {t("rate.distance")}
          <UnitInput unit="km" value={kmInput} placeholder={String(km)} onChange={(e) => setKmInput(e.target.value)} min={0} step="any" />
        </label>
      </div>

      {res.ok ? (
        <Button type="button" variant="accent" onClick={() => onUse(perSelling(res.price))} className="self-start">
          {t("rate.use", { price: f.perUnit(perSelling(res.price), unit) })}
        </Button>
      ) : null}

      <div>
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-10 items-center gap-2 text-small font-semibold text-ink">
          {t("rate.how")}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open ? (
          <ol className="mt-2 flex flex-col gap-1.5 text-small">
            {res.steps.map((st) => (
              <li key={st.key} className="flex items-baseline justify-between gap-3 border-b border-haldi/30 pb-1.5 last:border-0">
                <span className="text-ink">
                  {label(st.key)}
                  {st.key === "nudge" && !st.active ? <span className="text-ink-muted"> ({t("rate.nudgeOff")})</span> : null}
                  {st.key === "bigLot" ? <span className="text-ink-muted"> (−{Math.round(st.cut * 1000) / 10}%)</span> : null}
                  {st.key === "ageing" && st.factor < 1 ? <span className="text-ink-muted"> (×{st.factor.toFixed(2)})</span> : null}
                </span>
                <span className="font-semibold text-ink tabular-nums">{Number.isFinite(st.value) ? f.money(Math.round(st.value * 100) / 100) : "—"}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
