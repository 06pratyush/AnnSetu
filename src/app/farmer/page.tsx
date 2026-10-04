"use client";

import Link from "next/link";
import { useState } from "react";
import { ChartColumn, ClipboardList, HandCoins, Inbox, Plus, Table2, Warehouse, Wheat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { useFormat } from "@/lib/i18n/format";
import { useFarmerOrders, useMyProduce } from "@/lib/queries";
import { useFarmerSuggestions } from "@/lib/recommend/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard } from "@/components/domain/figures";
import { EmptyState } from "@/components/domain/empty-state";
import { OrderStatusBadge } from "@/components/domain/orders";
import { SuggestionPanel } from "@/components/domain/demand";
import { RevenueChart, weeklyRevenue } from "@/components/charts/revenue-chart";
import { StockOverview } from "@/components/charts/stock-overview";

function ViewToggle({ view, onChange }: { view: "chart" | "table"; onChange: (v: "chart" | "table") => void }) {
  const { t } = useTranslation();
  return (
    <Button variant="ghost" size="sm" onClick={() => onChange(view === "chart" ? "table" : "chart")}>
      {view === "chart" ? <Table2 aria-hidden /> : <ChartColumn aria-hidden />}
      {view === "chart" ? t("dashboard.viewTable") : t("dashboard.viewChart")}
    </Button>
  );
}

export default function FarmerDashboard() {
  const { t } = useTranslation();
  const f = useFormat();
  const { profile } = useAuth();
  const produce = useMyProduce();
  const orders = useFarmerOrders();
  const suggestions = useFarmerSuggestions();
  const [stockView, setStockView] = useState<"chart" | "table">("chart");
  const [revenueView, setRevenueView] = useState<"chart" | "table">("chart");

  const items = produce.data ?? [];
  const allOrders = orders.data ?? [];
  const earned = allOrders.filter((o) => o.status === "delivered").reduce((s, o) => s + o.total, 0);
  const unsoldValue = items.reduce((s, p) => s + p.qty_available * p.price_per_unit, 0);
  const newOrders = allOrders.filter((o) => o.status === "placed").length;
  const inProgress = allOrders.filter((o) => ["placed", "accepted", "packed", "out_for_delivery"].includes(o.status)).length;
  const active = items.filter((p) => p.status === "active").length;
  const soldOut = items.filter((p) => p.status === "sold_out").length;
  const weeks = weeklyRevenue(allOrders, 8, (d) => f.date(d));
  const firstName = profile?.full_name.split(" ")[0] ?? "";

  return (
    <>
      <PageHeader
        title={t("dashboard.greeting", { name: firstName })}
        subtitle={t("dashboard.subtitle")}
        actions={
          <Button asChild size="lg">
            <Link href="/farmer/produce/new">
              <Plus aria-hidden />
              {t("produce.add")}
            </Link>
          </Button>
        }
      />

      <section aria-label={t("dashboard.subtitle")} className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {produce.isLoading || orders.isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <StatCard icon={HandCoins} label={t("dashboard.revenue")} value={f.moneyCompact(earned)} hint={t("dashboard.revenueHint")} />
            <StatCard icon={Warehouse} label={t("dashboard.unsoldValue")} value={f.moneyCompact(unsoldValue)} hint={t("dashboard.unsoldHint")} />
            <StatCard
              icon={ClipboardList}
              label={t("dashboard.pendingOrders")}
              value={f.number(inProgress)}
              hint={newOrders ? `${t("orders.status.placed")}: ${f.number(newOrders)}` : t("dashboard.pendingHint")}
              attention={newOrders > 0}
            />
            <StatCard icon={Wheat} label={t("dashboard.activeListings")} value={f.number(active)} hint={t("dashboard.activeHint", { count: soldOut })} />
          </>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>{t("dashboard.stockTitle")}</CardTitle>
                <CardDescription>{t("dashboard.stockSubtitle")}</CardDescription>
              </div>
              {items.length ? <ViewToggle view={stockView} onChange={setStockView} /> : null}
            </CardHeader>
            <CardContent>
              {produce.isLoading ? (
                <Skeleton className="h-40" />
              ) : items.length === 0 ? (
                <EmptyState
                  icon={Wheat}
                  title={t("produce.empty")}
                  body={t("dashboard.noStock")}
                  action={
                    <Button asChild>
                      <Link href="/farmer/produce/new">{t("produce.add")}</Link>
                    </Button>
                  }
                />
              ) : (
                <StockOverview produce={items} view={stockView} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>{t("dashboard.revenueTitle")}</CardTitle>
                <CardDescription>{t("dashboard.revenueSubtitle")}</CardDescription>
              </div>
              <ViewToggle view={revenueView} onChange={setRevenueView} />
            </CardHeader>
            <CardContent>{orders.isLoading ? <Skeleton className="h-56" /> : <RevenueChart data={weeks} view={revenueView} />}</CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <SuggestionPanel
            suggestions={suggestions.data ?? []}
            loading={suggestions.isLoading}
            listHref={(s) => (s.demand ? `/farmer/produce/new?demand=${s.demand.id}` : undefined)}
            seeAllHref="/farmer/suggestions"
          />

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle>{t("dashboard.recentOrders")}</CardTitle>
              {allOrders.length ? (
                <Button asChild variant="link" size="sm">
                  <Link href="/farmer/orders">{t("common.seeAll")}</Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {orders.isLoading ? (
                <Skeleton className="h-32" />
              ) : allOrders.length === 0 ? (
                <EmptyState icon={Inbox} title={t("dashboard.noOrders")} body={t("dashboard.noOrdersBody")} />
              ) : (
                <ul className="flex flex-col">
                  {allOrders.slice(0, 4).map((o) => (
                    <li key={o.id} className="border-b border-border last:border-0">
                      <Link href="/farmer/orders" className="flex items-center justify-between gap-3 py-3 hover:bg-sunken">
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-body font-semibold text-ink">{o.buyer_name}</span>
                          <span className="text-small text-ink-muted">
                            {f.relative(o.created_at)} · {f.money(o.total)}
                          </span>
                        </span>
                        <OrderStatusBadge status={o.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
