"use client";

import Link from "next/link";
import {
  Archive,
  Ellipsis,
  History,
  IndianRupee,
  Leaf,
  Lock,
  LockOpen,
  MapPin,
  Pause,
  Pencil,
  Play,
  PackagePlus,
  SlidersHorizontal,
  Star,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormat } from "@/lib/i18n/format";
import type { LedgerEntry as LedgerRow, LedgerType, MarketListing, Produce, ProduceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/controls";
import { ProducePhoto } from "./brand";
import { PriceTag } from "./figures";
import { StockBar } from "./stock-bar";

export function ProduceStatusBadge({ status }: { status: ProduceStatus }) {
  const { t } = useTranslation();
  const map = {
    active: { tone: "success", icon: Play },
    paused: { tone: "warning", icon: Pause },
    sold_out: { tone: "neutral", icon: Lock },
    archived: { tone: "neutral", icon: Archive },
  } as const;
  const { tone, icon: Icon } = map[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden />
      {t(`produce.status.${status}`)}
    </Badge>
  );
}

export function OrganicBadge() {
  const { t } = useTranslation();
  return (
    <Badge tone="success">
      <Leaf aria-hidden />
      {t("produce.organic")}
    </Badge>
  );
}

/** Marketplace card. The whole card is one link to the listing. */
export function ProduceCard({ listing, href, className }: { listing: MarketListing; href: string; className?: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-w-0 flex-col gap-3 rounded-md border border-border bg-surface p-3 transition-shadow duration-150 hover:shadow-card",
        className,
      )}
    >
      <div className="relative">
        <ProducePhoto src={listing.images[0]} category={listing.category} alt="" />
        {listing.is_organic ? (
          <span className="absolute top-2 left-2">
            <OrganicBadge />
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-1">
        <h3 className="truncate font-display text-h3 font-semibold text-ink group-hover:underline">
          {listing.name}
          {listing.variety ? <span className="font-body text-body font-normal text-ink-muted"> · {listing.variety}</span> : null}
        </h3>
        <PriceTag price={listing.price_per_unit} unit={listing.unit} />
        <p className="text-small text-ink-muted tabular-nums">{t("market.available", { qty: f.number(listing.qty_available), unit: f.unit(listing.unit) })}</p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2 text-small">
          <span className="flex min-w-0 items-center gap-1 text-ink">
            <MapPin className="size-4 shrink-0 text-ink-muted" aria-hidden />
            <span className="truncate">
              {listing.farmer_name}
              {listing.district ? <span className="text-ink-muted"> · {listing.district}</span> : null}
            </span>
          </span>
          {listing.farmer_rating ? (
            <span className="flex shrink-0 items-center gap-1 text-ink" aria-label={t("rating.label", { value: listing.farmer_rating.toFixed(1) })}>
              <Star className="size-4 fill-haldi text-haldi-ink" aria-hidden />
              <span className="tabular-nums">{listing.farmer_rating.toFixed(1)}</span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/** Farmer's own listing: photo, status, price, stock bar and the actions for it. */
export function ProduceRow({
  produce,
  editHref,
  logHref,
  onUpdateStock,
  onSetStatus,
  className,
}: {
  produce: Produce;
  editHref: string;
  logHref: string;
  onUpdateStock?: () => void;
  onSetStatus?: (status: ProduceStatus) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <article className={cn("flex min-w-0 flex-col gap-4 rounded-md border border-border bg-surface p-4 sm:flex-row sm:items-center", className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <ProducePhoto src={produce.images[0]} category={produce.category} alt="" className="w-20 shrink-0 sm:w-24" iconClassName="size-7" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-h3 font-semibold text-ink">{produce.name}</h3>
            <ProduceStatusBadge status={produce.status} />
            {produce.is_organic ? <OrganicBadge /> : null}
          </div>
          <PriceTag price={produce.price_per_unit} unit={produce.unit} size="sm" />
          <StockBar
            name={produce.name}
            unit={produce.unit}
            sold={produce.qty_sold}
            reserved={produce.qty_reserved}
            available={produce.qty_available}
            spoiled={produce.qty_spoiled}
            size="sm"
            className="max-w-md"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        {onUpdateStock ? (
          <Button variant="secondary" onClick={onUpdateStock} className="flex-1 sm:flex-none">
            <PackagePlus aria-hidden />
            {t("ledger.update")}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`${t("common.menu")}: ${produce.name}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={editHref}>
                <Pencil aria-hidden />
                {t("common.edit")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={logHref}>
                <History aria-hidden />
                {t("produce.log")}
              </Link>
            </DropdownMenuItem>
            {onSetStatus && produce.status === "active" ? (
              <DropdownMenuItem onSelect={() => onSetStatus("paused")}>
                <Pause aria-hidden />
                {t("produce.pause")}
              </DropdownMenuItem>
            ) : null}
            {onSetStatus && produce.status === "paused" ? (
              <DropdownMenuItem onSelect={() => onSetStatus("active")}>
                <Play aria-hidden />
                {t("produce.resume")}
              </DropdownMenuItem>
            ) : null}
            {onSetStatus && produce.status !== "archived" ? (
              <DropdownMenuItem onSelect={() => onSetStatus("archived")} className="text-danger [&_svg]:text-danger">
                <Archive aria-hidden />
                {t("produce.archive")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

export const LEDGER_META: Record<LedgerType, { icon: LucideIcon; sign: "+" | "-" | "" | "±" }> = {
  listed: { icon: PackagePlus, sign: "+" },
  restocked: { icon: PackagePlus, sign: "+" },
  reserved: { icon: Lock, sign: "-" },
  released: { icon: LockOpen, sign: "+" },
  sold: { icon: IndianRupee, sign: "" },
  spoiled: { icon: TriangleAlert, sign: "-" },
  adjusted: { icon: SlidersHorizontal, sign: "±" },
};

/** One line of the stock log. The sign shows the effect on unsold stock; "sold" moves reserved stock, so it has none. */
export function LedgerEntry({ entry, unit }: { entry: LedgerRow; unit: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { icon: Icon, sign } = LEDGER_META[entry.change_type];
  const shownSign = sign === "±" ? (entry.quantity < 0 ? "−" : "+") : sign === "-" ? "−" : sign;
  const magnitude = Math.abs(entry.quantity);
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          entry.change_type === "spoiled" ? "bg-danger-soft text-danger" : entry.change_type === "sold" ? "bg-success-soft text-success" : "bg-sunken text-ink-muted",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-body font-semibold text-ink">{t(`ledger.types.${entry.change_type}`)}</p>
        <p className="text-small text-ink-muted">
          {f.dateTime(entry.created_at)}
          {entry.order_id ? ` · ${t("ledger.orderRef", { id: entry.order_id.slice(0, 8).toUpperCase() })}` : ""}
        </p>
        {entry.note ? <p className="text-small text-ink">“{entry.note}”</p> : null}
      </div>
      <p className={cn("shrink-0 text-body font-semibold tabular-nums", entry.change_type === "spoiled" ? "text-danger" : "text-ink")}>
        {shownSign}
        {f.qty(magnitude, unit)}
      </p>
    </li>
  );
}
