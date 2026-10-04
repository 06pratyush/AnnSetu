"use client";

import { Ban, CircleCheck, CircleX, Clock, MapPin, Package, PackageCheck, Phone, Truck, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormat } from "@/lib/i18n/format";
import type { Order, OrderStatus, StatusEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

type Tone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export const ORDER_STATUS_META: Record<OrderStatus, { icon: LucideIcon; tone: Tone }> = {
  placed: { icon: Clock, tone: "info" },
  accepted: { icon: CircleCheck, tone: "role" },
  packed: { icon: Package, tone: "role" },
  out_for_delivery: { icon: Truck, tone: "accent" },
  delivered: { icon: PackageCheck, tone: "success" },
  rejected: { icon: CircleX, tone: "danger" },
  cancelled: { icon: Ban, tone: "neutral" },
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const { t } = useTranslation();
  const { icon: Icon, tone } = ORDER_STATUS_META[status];
  return (
    <Badge tone={tone} className={className}>
      <Icon aria-hidden />
      {t(`orders.status.${status}`)}
    </Badge>
  );
}

const HAPPY_PATH: OrderStatus[] = ["placed", "accepted", "packed", "out_for_delivery", "delivered"];

/** Vertical timeline of the order's journey. A rejected or cancelled order ends early in its own state. */
export function OrderTimeline({ status, history }: { status: OrderStatus; history: StatusEvent[] }) {
  const { t } = useTranslation();
  const f = useFormat();
  const at = (s: OrderStatus) => history.find((h) => h.status === s)?.at;
  const terminal = status === "rejected" || status === "cancelled";
  const reached = new Set(history.map((h) => h.status));
  const steps: OrderStatus[] = terminal ? [...HAPPY_PATH.filter((s) => reached.has(s)), status] : HAPPY_PATH;
  const currentIndex = steps.indexOf(status);

  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const done = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const { icon: Icon } = ORDER_STATUS_META[s];
        const when = at(s);
        return (
          <li key={s} className="relative flex gap-3 pb-4 last:pb-0" aria-current={isCurrent ? "step" : undefined}>
            {i < steps.length - 1 ? (
              <span aria-hidden className={cn("absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5", i < currentIndex ? "bg-role" : "bg-border")} />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                done ? "border-role bg-role text-on-role" : "border-border bg-surface text-ink-muted",
                done && s === "rejected" && "border-danger bg-danger text-on-danger",
                done && s === "cancelled" && "border-border-strong bg-sunken text-ink",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col pt-1">
              <span className={cn("text-small font-semibold", done ? "text-ink" : "text-ink-muted")}>{t(`orders.status.${s}`)}</span>
              {when ? <span className="text-label text-ink-muted">{f.dateTime(when)}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export type OrderAction = { status: OrderStatus; label: string; tone: "primary" | "danger" | "secondary" };

/** The next steps each side may take; mirrors the transitions the database allows. */
export function nextActions(order: Pick<Order, "status">, perspective: "farmer" | "buyer", t: (k: string) => string): OrderAction[] {
  if (perspective === "buyer") {
    return order.status === "placed" || order.status === "accepted"
      ? [{ status: "cancelled", label: t("orders.cancel"), tone: "danger" }]
      : [];
  }
  switch (order.status) {
    case "placed":
      return [
        { status: "accepted", label: t("orders.accept"), tone: "primary" },
        { status: "rejected", label: t("orders.reject"), tone: "danger" },
      ];
    case "accepted":
      return [
        { status: "packed", label: t("orders.markPacked"), tone: "primary" },
        { status: "cancelled", label: t("orders.cancel"), tone: "secondary" },
      ];
    case "packed":
      return [
        { status: "out_for_delivery", label: t("orders.markOut"), tone: "primary" },
        { status: "cancelled", label: t("orders.cancel"), tone: "secondary" },
      ];
    case "out_for_delivery":
      return [{ status: "delivered", label: t("orders.markDelivered"), tone: "primary" }];
    default:
      return [];
  }
}

/** One order as either side sees it: who, what, where, and the next step. */
export function OrderCard({
  order,
  perspective,
  onAction,
  busyStatus,
  footer,
  className,
}: {
  order: Order;
  perspective: "farmer" | "buyer";
  onAction?: (status: OrderStatus) => void;
  busyStatus?: OrderStatus | null;
  footer?: React.ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const actions = onAction ? nextActions(order, perspective, t) : [];
  const counterpart = perspective === "farmer" ? order.buyer_name : order.farmer_name;
  const contactPhone = perspective === "farmer" ? order.delivery_phone : order.farmer_phone;
  const isNew = perspective === "farmer" && order.status === "placed";

  return (
    <article
      className={cn("flex min-w-0 flex-col rounded-md border bg-surface", isNew ? "border-haldi" : "border-border", className)}
      aria-label={t("orders.orderNo", { id: order.id.slice(0, 8).toUpperCase() })}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-4">
        <div className="flex min-w-0 flex-col">
          <p className="font-display text-h3 font-semibold text-ink">{counterpart}</p>
          <p className="text-small text-ink-muted">
            {t("orders.orderNo", { id: order.id.slice(0, 8).toUpperCase() })} · {t("orders.placedOn", { date: f.relative(order.created_at) })}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      <div className="flex flex-col gap-4 p-4">
        <ul className="flex flex-col gap-1.5" aria-label={t("orders.items")}>
          {(order.order_items ?? []).map((it) => (
            <li key={it.id} className="flex items-baseline justify-between gap-3 text-body">
              <span className="min-w-0 truncate text-ink">
                {it.name} <span className="text-ink-muted">× {f.qty(it.quantity, it.unit)}</span>
              </span>
              <span className="font-semibold text-ink tabular-nums">{f.money(it.quantity * it.unit_price)}</span>
            </li>
          ))}
          <li className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-2 text-body">
            <span className="font-semibold text-ink">
              {t("common.total")} <span className="font-normal text-ink-muted">· {t("orders.cod")}</span>
            </span>
            <span className="font-display text-h3 font-semibold text-ink tabular-nums">{f.money(order.total)}</span>
          </li>
        </ul>

        {perspective === "farmer" ? (
          <div className="flex flex-col gap-1 rounded-sm bg-sunken p-3 text-small">
            <p className="flex items-start gap-2 text-ink">
              <MapPin className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
              <span>
                <span className="sr-only">{t("orders.deliverTo")}: </span>
                {order.delivery_name}, {order.delivery_line1}
                {order.delivery_line2 ? `, ${order.delivery_line2}` : ""}, {order.delivery_village_city}, {order.delivery_district}, {order.delivery_state}{" "}
                {order.delivery_pincode}
              </span>
            </p>
            {order.delivery_notes ? <p className="pl-6 text-ink-muted">“{order.delivery_notes}”</p> : null}
          </div>
        ) : null}

        {contactPhone && order.status !== "rejected" && order.status !== "cancelled" ? (
          <p className="flex items-center gap-2 text-small text-ink">
            <Phone className="size-4 text-ink-muted" aria-hidden />
            <span className="text-ink-muted">{perspective === "farmer" ? t("orders.buyer") : t("orders.farmer")}:</span>
            <span className="font-semibold tabular-nums select-all">{contactPhone}</span>
          </p>
        ) : null}
      </div>

      {actions.length > 0 || footer ? (
        <footer className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:flex-wrap sm:items-center">
          {actions.map((a) => (
            <Button
              key={a.status}
              variant={a.tone === "primary" ? "primary" : a.tone === "danger" ? "secondary" : "ghost"}
              className={cn(a.tone === "danger" && "text-danger", a.tone === "primary" && "sm:min-w-44")}
              loading={busyStatus === a.status}
              disabled={Boolean(busyStatus) && busyStatus !== a.status}
              onClick={() => onAction?.(a.status)}
            >
              {a.label}
            </Button>
          ))}
          {footer}
        </footer>
      ) : null}
    </article>
  );
}
