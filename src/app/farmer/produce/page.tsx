"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Wheat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { updateProduce } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { keys, useMyProduce } from "@/lib/queries";
import type { Produce, ProduceStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toaster";
import { PageHeader } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/domain/empty-state";
import { ProduceRow } from "@/components/domain/produce";
import { StockDialog } from "@/components/forms/stock-dialog";

type Filter = "all" | "active" | "paused" | "sold_out";

export default function MyProducePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const produce = useMyProduce();
  const [filter, setFilter] = useState<Filter>("all");
  const [stockFor, setStockFor] = useState<Produce | null>(null);
  const [archiving, setArchiving] = useState<Produce | null>(null);
  const [busy, setBusy] = useState(false);

  const items = (produce.data ?? []).filter((p) => filter === "all" || p.status === filter);
  const count = (s: Filter) => (produce.data ?? []).filter((p) => s === "all" || p.status === s).length;

  async function setStatus(p: Produce, status: ProduceStatus) {
    setBusy(true);
    try {
      await updateProduce(p.id, { status });
      toast.success(t("produce.updated"));
      await qc.invalidateQueries({ queryKey: keys.myProduce(profile?.id) });
      setArchiving(null);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("produce.title")}
        subtitle={t("produce.subtitle")}
        actions={
          <Button asChild size="lg">
            <Link href="/farmer/produce/new">
              <Plus aria-hidden />
              {t("produce.add")}
            </Link>
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-4">
        <TabsList>
          {(["all", "active", "paused", "sold_out"] as Filter[]).map((f) => (
            <TabsTrigger key={f} value={f}>
              {f === "all" ? t("produce.filterAll") : t(`produce.status.${f}`)}
              <span className="rounded-full bg-sunken px-2 text-label text-ink-muted tabular-nums">{count(f)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {produce.isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Wheat}
          title={t("produce.empty")}
          body={t("produce.emptyBody")}
          action={
            <Button asChild>
              <Link href="/farmer/produce/new">{t("produce.add")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((p) => (
            <ProduceRow
              key={p.id}
              produce={p}
              editHref={`/farmer/produce/edit?id=${p.id}`}
              logHref={`/farmer/produce/log?id=${p.id}`}
              onUpdateStock={() => setStockFor(p)}
              onSetStatus={(s) => (s === "archived" ? setArchiving(p) : void setStatus(p, s))}
            />
          ))}
        </div>
      )}

      <StockDialog produce={stockFor} open={Boolean(stockFor)} onOpenChange={(o) => !o && setStockFor(null)} />
      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={t("produce.archiveTitle", { name: archiving?.name ?? "" })}
        body={t("produce.archiveBody")}
        confirmLabel={t("produce.archive")}
        cancelLabel={t("common.cancel")}
        loading={busy}
        onConfirm={() => archiving && void setStatus(archiving, "archived")}
      />
    </>
  );
}
