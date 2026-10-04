"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, History, PackagePlus, Pencil, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { PageSkeleton } from "@/lib/auth/role-guard";
import { useFormat } from "@/lib/i18n/format";
import { useLedger, useProduce } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/domain/empty-state";
import { PriceTag } from "@/components/domain/figures";
import { LedgerEntry, ProduceStatusBadge } from "@/components/domain/produce";
import { StockBar } from "@/components/domain/stock-bar";
import { StockDialog } from "@/components/forms/stock-dialog";

function StockLog() {
  const { t } = useTranslation();
  const f = useFormat();
  const { profile } = useAuth();
  const id = useSearchParams().get("id");
  const produce = useProduce(id);
  const ledger = useLedger(id);
  const [open, setOpen] = useState(false);

  if (produce.isLoading) return <PageSkeleton />;
  if (!produce.data || produce.data.farmer_id !== profile?.id) return <EmptyState icon={SearchX} title={t("produce.notFound")} />;
  const p = produce.data;

  return (
    <>
      <Link href="/farmer/produce" className="mb-3 inline-flex items-center gap-1.5 text-small font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        {t("produce.title")}
      </Link>
      <PageHeader
        title={t("ledger.title")}
        subtitle={t("ledger.subtitle", { name: p.name })}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={`/farmer/produce/edit?id=${p.id}`}>
                <Pencil aria-hidden />
                {t("common.edit")}
              </Link>
            </Button>
            <Button onClick={() => setOpen(true)}>
              <PackagePlus aria-hidden />
              {t("ledger.update")}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="order-2 lg:order-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-5 text-ink-muted" aria-hidden />
              {t("produce.log")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ledger.isLoading ? (
              <Skeleton className="h-48" />
            ) : !ledger.data?.length ? (
              <p className="text-body text-ink-muted">{t("ledger.empty")}</p>
            ) : (
              <ol className="divide-y divide-border">
                {ledger.data.map((e) => (
                  <LedgerEntry key={e.id} entry={e} unit={p.unit} />
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card className="order-1 h-fit lg:order-2">
          <CardContent className="flex flex-col gap-4 pt-4 sm:pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-h2 font-semibold text-ink">{p.name}</h2>
              <ProduceStatusBadge status={p.status} />
            </div>
            <PriceTag price={p.price_per_unit} unit={p.unit} />
            <StockBar name={p.name} unit={p.unit} sold={p.qty_sold} reserved={p.qty_reserved} available={p.qty_available} spoiled={p.qty_spoiled} />
            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-small">
              <div>
                <dt className="text-ink-muted">{t("produce.listed")}</dt>
                <dd className="font-display text-h3 font-semibold text-ink">{f.qty(p.qty_listed, p.unit)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t("produce.available")}</dt>
                <dd className="font-display text-h3 font-semibold text-ink">{f.qty(p.qty_available, p.unit)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <StockDialog produce={p} open={open} onOpenChange={setOpen} />
    </>
  );
}

export default function StockLogPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StockLog />
    </Suspense>
  );
}
