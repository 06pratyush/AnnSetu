"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, ChevronDown, Clock, Info, Leaf, MapPin, Star, Truck, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormat } from "@/lib/i18n/format";
import type { DeliveryBatch, HiddenReason, MatchRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ProducePhoto } from "./brand";
import { PriceTag } from "./figures";

/** "New farmer" until there is a record; then share delivered on time and how many orders. */
export function TrustLine({ completed, onTime, className }: { completed: number; onTime: number; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn("inline-flex items-center gap-1 text-small text-ink-muted", className)}>
      <Star className="size-4 shrink-0" aria-hidden />
      {completed === 0 ? t("matching.newFarmer") : t("matching.onTime", { pct: Math.round((onTime / completed) * 100), count: completed })}
    </span>
  );
}

/** Freshness as the buyer will get it: share of shelf life left on arrival. */
export function FreshLine({ hoursUsed, shelfLifeHours, harvestedAt, className }: { hoursUsed: number; shelfLifeHours: number; harvestedAt: string; className?: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const left = Math.max(0, Math.round((1 - hoursUsed / shelfLifeHours) * 100));
  return (
    <span className={cn("inline-flex items-center gap-1 text-small text-ink-muted", className)}>
      <Clock className="size-4 shrink-0" aria-hidden />
      {t("matching.picked", { when: f.relative(harvestedAt) })} · {t("matching.freshLeft", { pct: left })}
    </span>
  );
}

const PARTS = ["price", "fresh", "near", "trust", "fill"] as const;

/** Step 3, opened up: the five part-scores behind a listing's place in the list. */
export function ScoreBreakdown({ row, weights, className }: { row: MatchRow; weights: Record<(typeof PARTS)[number], number>; className?: string }) {
  const { t } = useTranslation();
  const value = { price: row.part_price, fresh: row.part_fresh, near: row.part_near, trust: row.part_trust, fill: row.part_fill };
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <dl className="flex flex-col gap-1.5">
        {PARTS.filter((p) => weights[p] > 0).map((p) => (
          <div key={p} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3rem] items-center gap-2 text-small">
            <dt className="text-ink-muted">{t(`matching.part.${p}`)}</dt>
            <dd className="h-2 overflow-hidden rounded-full bg-stock-track" aria-hidden>
              <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.round(value[p] * 100)}%` }} />
            </dd>
            <dd className="text-right text-ink tabular-nums">
              <span className="sr-only">{t(`matching.part.${p}`)}: </span>
              {Math.round(value[p] * 100)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-label text-ink-muted">{t("matching.scoreNote", { score: Math.round(row.score * 100) })}</p>
    </div>
  );
}

/** A market result: the listing plus what the engine knows about serving this buyer. */
export function MatchCard({
  row,
  href,
  name,
  quantity,
  pooled,
  weights,
  className,
}: {
  row: MatchRow;
  href: string;
  /** Item name in the UI language. */
  name: string;
  /** The buyer's wanted quantity in the listing's unit, when known. */
  quantity: number | null;
  /** Households share delivery; businesses pay one trip. */
  pooled: boolean;
  weights: Record<(typeof PARTS)[number], number>;
  className?: string;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const [why, setWhy] = useState(false);
  const delivered = !pooled && quantity && row.trip_cost !== null ? row.price_per_unit + row.trip_cost / quantity : null;
  return (
    <article className={cn("flex min-w-0 flex-col rounded-md border border-border bg-surface", className)}>
      <Link href={href} className="group flex min-w-0 flex-col gap-3 p-3">
        <div className="relative">
          <ProducePhoto src={row.images[0]} category={row.category} alt="" />
          <span className="absolute top-2 left-2 flex flex-wrap gap-1.5">
            {row.is_organic ? (
              <Badge tone="success">
                <Leaf aria-hidden />
                {t("produce.organic")}
              </Badge>
            ) : null}
            {row.farmer_verified ? (
              <Badge tone="info">
                <BadgeCheck aria-hidden />
                {t("matching.verified")}
              </Badge>
            ) : null}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1 px-1">
          <h3 className="truncate font-display text-h3 font-semibold text-ink group-hover:underline">
            {name}
            {row.variety ? <span className="font-body text-body font-normal text-ink-muted"> · {row.variety}</span> : null}
          </h3>
          <PriceTag price={row.price_per_unit} unit={row.unit} />
          {delivered !== null ? (
            <p className="text-small text-ink">{t("matching.withDelivery", { price: f.perUnit(Math.round(delivered * 100) / 100, row.unit) })}</p>
          ) : null}
          <p className="text-small text-ink-muted tabular-nums">{t("market.available", { qty: f.number(row.qty_available), unit: f.unit(row.unit) })}</p>
          <FreshLine hoursUsed={row.hours_used} shelfLifeHours={row.shelf_life_hours} harvestedAt={row.harvested_at} />
          <TrustLine completed={row.orders_completed} onTime={row.orders_on_time} />
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-2 text-small">
            <span className="flex min-w-0 items-center gap-1 text-ink">
              <MapPin className="size-4 shrink-0 text-ink-muted" aria-hidden />
              <span className="truncate">
                {row.farmer_name}
                {row.distance_km !== null ? <span className="text-ink-muted"> · {t("matching.kmAway", { km: f.number(row.distance_km, 0) })}</span> : null}
              </span>
            </span>
            {pooled ? (
              <span className="flex shrink-0 items-center gap-1 text-ink-muted" title={t("matching.sharedDelivery")}>
                <Users className="size-4" aria-hidden />
                <span className="sr-only">{t("matching.sharedDelivery")}</span>
              </span>
            ) : row.trip_cost !== null ? (
              <span className="flex shrink-0 items-center gap-1 text-ink-muted">
                <Truck className="size-4" aria-hidden />
                <span className="tabular-nums">{f.money(row.trip_cost)}</span>
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      <div className="border-t border-border px-4 py-2">
        <button
          type="button"
          aria-expanded={why}
          onClick={() => setWhy((w) => !w)}
          className="flex min-h-10 w-full items-center justify-between gap-2 text-small font-semibold text-ink"
        >
          {t("matching.why")}
          <ChevronDown className={cn("size-4 transition-transform", why && "rotate-180")} aria-hidden />
        </button>
        {why ? <ScoreBreakdown row={row} weights={weights} className="pb-2" /> : null}
      </div>
    </article>
  );
}

/** "3 farms hidden: 2 too far, 1 wouldn't arrive fresh." */
export function HiddenNote({ hidden, className }: { hidden: { reason: HiddenReason; listings: number }[]; className?: string }) {
  const { t } = useTranslation();
  const total = hidden.reduce((s, h) => s + h.listings, 0);
  if (!total) return null;
  return (
    <p className={cn("flex items-start gap-2 text-small text-ink-muted", className)}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {t("matching.hidden", { count: total })}{" "}
        {hidden.map((h) => t(`matching.reason.${h.reason}`, { count: h.listings })).join(", ")}.
      </span>
    </p>
  );
}

/**
 * A household batch filling up: savings against the shop versus the trip cost. It ships when the
 * bar fills (the trip pays for itself) or at the cut-off time.
 */
export function BatchProgress({ batch, className }: { batch: Pick<DeliveryBatch, "room" | "trip_cost" | "load_qty" | "cutoff_at" | "status" | "below_break_even">; className?: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const pct = batch.trip_cost > 0 ? Math.min(100, Math.round((batch.room / batch.trip_cost) * 100)) : 100;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        role="progressbar"
        aria-label={t("matching.batchProgress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2.5 w-full overflow-hidden rounded-full bg-stock-track"
      >
        <div className="h-full rounded-full bg-chart-2" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-small text-ink-muted">
        {batch.status === "open"
          ? t("matching.batchOpen", { pct, kg: f.number(batch.load_qty), when: f.dateTime(batch.cutoff_at) })
          : batch.below_break_even
            ? t("matching.batchBelow")
            : t("matching.batchShipped")}
      </p>
    </div>
  );
}
