"use client";

import Link from "next/link";
import { useState } from "react";
import { Leaf, MapPin, Search, Star, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormat } from "@/lib/i18n/format";
import { CATEGORY_SLUGS, type CategorySlug, type FarmerPublic } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/controls";
import { NativeSelect } from "@/components/ui/input";
import { CategoryIcon } from "./brand";

/** Single-choice category filter. Scrolls sideways on phones instead of wrapping into a wall. */
export function CategoryChips({
  value,
  onChange,
  className,
}: {
  value: CategorySlug | "all";
  onChange: (value: CategorySlug | "all") => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const options: (CategorySlug | "all")[] = ["all", ...CATEGORY_SLUGS];
  return (
    <div role="radiogroup" aria-label={t("produce.category")} className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0", className)}>
      {options.map((c) => {
        const selected = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(c)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-small font-semibold transition-colors",
              selected ? "border-role bg-role text-on-role" : "border-border-strong bg-surface text-ink hover:bg-sunken",
            )}
          >
            {c === "all" ? null : <CategoryIcon category={c} className="size-4" />}
            {t(`categories.${c}`)}
          </button>
        );
      })}
    </div>
  );
}

export type MarketSort = "newest" | "price_asc" | "price_desc";

/** Search, sort and the organic filter: one row above the results. */
export function SearchFilterBar({
  query,
  onQuery,
  sort,
  onSort,
  organic,
  onOrganic,
  sortLabels,
  className,
}: {
  query: string;
  onQuery: (q: string) => void;
  sort: MarketSort;
  onSort: (s: MarketSort) => void;
  organic: boolean;
  onOrganic: (v: boolean) => void;
  /** Override option labels, e.g. "Best match" for the engine's own order. */
  sortLabels?: Partial<Record<MarketSort, string>>;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      <label className="relative flex-1">
        <span className="sr-only">{t("market.searchLabel")}</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("market.searchPlaceholder")}
          className="h-12 w-full rounded-sm border border-border-strong bg-surface pr-10 pl-10 text-body text-ink"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQuery("")}
            className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-sm text-ink-muted hover:text-ink"
            aria-label={t("common.clear")}
          >
            <X className="size-5" aria-hidden />
          </button>
        ) : null}
      </label>
      <div className="flex gap-3">
        <button
          type="button"
          aria-pressed={organic}
          onClick={() => onOrganic(!organic)}
          className={cn(
            "inline-flex h-12 shrink-0 items-center gap-2 rounded-sm border px-4 text-small font-semibold",
            organic ? "border-success bg-success-soft text-success" : "border-border-strong bg-surface text-ink hover:bg-sunken",
          )}
        >
          <Leaf className="size-4" aria-hidden />
          {t("market.organicOnly")}
        </button>
        <NativeSelect aria-label={t("market.sort")} value={sort} onChange={(e) => onSort(e.target.value as MarketSort)} className="min-w-0 flex-1 sm:w-56">
          <option value="newest">{sortLabels?.newest ?? t("market.sortNewest")}</option>
          <option value="price_asc">{sortLabels?.price_asc ?? t("market.sortPriceLow")}</option>
          <option value="price_desc">{sortLabels?.price_desc ?? t("market.sortPriceHigh")}</option>
        </NativeSelect>
      </div>
    </div>
  );
}

/** Stars for display, or (with onChange) a 1–5 radio input with 48px targets. */
export function RatingStars({
  value,
  onChange,
  count,
  size = "md",
  className,
}: {
  value: number | null;
  onChange?: (v: number) => void;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  if (onChange) {
    return (
      <div role="radiogroup" aria-label={t("orders.yourRating")} className={cn("flex", className)} onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t("rating.set", { value: n })}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="flex size-12 items-center justify-center rounded-sm"
          >
            <Star className={cn("size-7", n <= shown ? "fill-haldi text-haldi-ink" : "text-border-strong")} aria-hidden />
          </button>
        ))}
      </div>
    );
  }
  const rounded = Math.round((value ?? 0) * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(size === "sm" ? "size-4" : "size-5", n <= rounded ? "fill-haldi text-haldi-ink" : n - 0.5 === rounded ? "fill-haldi-soft text-haldi-ink" : "text-border-strong")}
          />
        ))}
      </span>
      <span className="text-small text-ink tabular-nums">
        {value ? <span className="sr-only">{t("rating.label", { value: value.toFixed(1) })}</span> : <span>{t("rating.none")}</span>}
        {value ? <span aria-hidden>{value.toFixed(1)}</span> : null}
        {count !== undefined && value ? <span className="text-ink-muted"> ({count})</span> : null}
      </span>
    </span>
  );
}

/** Who grew it: avatar, farm, place and rating, linking to the public farmer page. */
export function FarmerCard({ farmer, href, className }: { farmer: FarmerPublic; href?: string; className?: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const place = [farmer.district, farmer.state].filter(Boolean).join(", ");
  const body = (
    <>
      <Avatar src={farmer.avatar_url} name={farmer.full_name} size={56} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-display text-h3 font-semibold text-ink">{farmer.full_name}</p>
        {farmer.farm_name ? <p className="text-small text-ink">{farmer.farm_name}</p> : null}
        {place ? (
          <p className="flex items-center gap-1 text-small text-ink-muted">
            <MapPin className="size-4" aria-hidden />
            {place}
          </p>
        ) : null}
        <RatingStars value={farmer.avg_rating} count={farmer.ratings_count} size="sm" />
        <p className="text-label text-ink-muted">{t("farmerProfile.since", { date: f.date(farmer.member_since, "long") })}</p>
      </div>
    </>
  );
  const cls = cn("flex min-w-0 items-start gap-4 rounded-md border border-border bg-surface p-4", href && "transition-shadow hover:shadow-card", className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
