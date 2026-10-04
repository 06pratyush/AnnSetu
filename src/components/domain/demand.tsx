"use client";

import Link from "next/link";
import { Building2, CalendarDays, Inbox, MapPin, PackagePlus, TrendingUp, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormat } from "@/lib/i18n/format";
import type { OpenDemand } from "@/lib/types";
import type { Suggestion } from "@/lib/recommend";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "./brand";
import { EmptyState } from "./empty-state";

/** A buyer's open request as a farmer sees it, with a shortcut to list matching produce. */
export function DemandCard({
  demand,
  listHref,
  reason,
  compact,
  className,
}: {
  demand: OpenDemand;
  listHref?: string;
  /** Optional one-line explanation from the recommendation logic. */
  reason?: string;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const place = [demand.district, demand.state].filter(Boolean).join(", ");
  const BuyerIcon = demand.buyer_type === "industrial" ? Building2 : User;
  return (
    <article className={cn("flex min-w-0 flex-col gap-3 rounded-md border border-border bg-surface p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-haldi-soft">
          <CategoryIcon category={demand.category} className="size-5 text-haldi-ink" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="font-display text-h3 font-semibold text-ink">{demand.item_name}</h3>
          <p className="text-body font-semibold text-ink tabular-nums">
            {t("suggestions.needed", { qty: f.number(demand.quantity), unit: f.unit(demand.unit) })}
          </p>
        </div>
        <Badge tone={demand.buyer_type === "industrial" ? "info" : "neutral"}>
          <BuyerIcon aria-hidden />
          {t(demand.buyer_type === "industrial" ? "roles.industrial" : "roles.individual")}
        </Badge>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-muted">
        {demand.needed_by ? (
          <li className="flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden />
            {t("suggestions.by", { date: f.date(demand.needed_by) })}
          </li>
        ) : null}
        {demand.target_price ? (
          <li className="flex items-center gap-1.5 text-ink">
            <TrendingUp className="size-4 text-ink-muted" aria-hidden />
            {t("suggestions.target", { price: f.money(demand.target_price), unit: f.unit(demand.unit) })}
          </li>
        ) : null}
        {place ? (
          <li className="flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden />
            {demand.buyer_label} · {place}
          </li>
        ) : null}
      </ul>

      {!compact && demand.notes ? <p className="text-small text-ink">“{demand.notes}”</p> : null}
      {reason ? <p className="text-small text-haldi-ink">{reason}</p> : null}

      {listHref ? (
        <Button asChild variant="outline" size={compact ? "sm" : "md"} className="self-start">
          <Link href={listHref}>
            <PackagePlus aria-hidden />
            {t("suggestions.listThis")}
          </Link>
        </Button>
      ) : null}
    </article>
  );
}

/**
 * The farmer's suggestion panel. It renders whatever the recommendation hook returns
 * (src/lib/recommend); by default that is open buyer requests, newest first.
 */
export function SuggestionPanel({
  suggestions,
  listHref,
  seeAllHref,
  limit = 3,
  loading,
  className,
}: {
  suggestions: Suggestion[];
  listHref: (s: Suggestion) => string | undefined;
  seeAllHref?: string;
  limit?: number;
  loading?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const shown = suggestions.slice(0, limit);
  return (
    <section aria-labelledby="suggestion-panel-title" className={cn("flex min-w-0 flex-col gap-4 rounded-md border border-border bg-surface p-4 sm:p-6", className)}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id="suggestion-panel-title" className="flex items-center gap-2 font-display text-h2 font-semibold text-ink">
            <span className="size-2.5 rounded-full bg-haldi" aria-hidden />
            {t("suggestions.panelTitle")}
          </h2>
          <p className="text-small text-ink-muted">{t("suggestions.panelSubtitle")}</p>
        </div>
        {seeAllHref && suggestions.length > limit ? (
          <Button asChild variant="link" size="sm">
            <Link href={seeAllHref}>{t("common.seeAll")}</Link>
          </Button>
        ) : null}
      </header>
      {loading ? (
        <div className="flex flex-col gap-3" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-md bg-sunken" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState icon={Inbox} title={t("suggestions.empty")} body={t("suggestions.emptyBody")} />
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((s) =>
            s.demand ? <DemandCard key={s.id} demand={s.demand} reason={s.reason} listHref={listHref(s)} compact /> : null,
          )}
        </div>
      )}
    </section>
  );
}

/** Totals of open requests per item: descriptive only, no ranking logic. */
export function TopRequested({ demand, className }: { demand: OpenDemand[]; className?: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const groups = new Map<string, { name: string; unit: string; qty: number; count: number }>();
  for (const d of demand) {
    const key = `${d.item_name.trim().toLowerCase()}|${d.unit}`;
    const g = groups.get(key) ?? { name: d.item_name.trim(), unit: d.unit, qty: 0, count: 0 };
    g.qty += Number(d.quantity);
    g.count += 1;
    groups.set(key, g);
  }
  const top = [...groups.values()].sort((a, b) => b.count - a.count || b.qty - a.qty).slice(0, 5);
  if (top.length === 0) return null;
  return (
    <section className={cn("rounded-md border border-border bg-surface p-4", className)} aria-labelledby="top-requested">
      <h2 id="top-requested" className="mb-2 font-display text-h3 font-semibold text-ink">
        {t("suggestions.topRequested")}
      </h2>
      <ol className="flex flex-col">
        {top.map((g) => (
          <li key={`${g.name}-${g.unit}`} className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0">
            <span className="min-w-0 truncate text-body font-semibold text-ink">{g.name}</span>
            <span className="shrink-0 text-small text-ink-muted tabular-nums">
              {f.qty(g.qty, g.unit)} · {t("suggestions.requests", { count: g.count })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
