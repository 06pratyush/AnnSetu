"use client";

import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useItemName } from "@/lib/matching/hooks";
import { useFarmerDemand } from "@/lib/queries";
import { Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/layout/app-shell";
import { DemandCard, TopRequested } from "@/components/domain/demand";
import { EmptyState } from "@/components/domain/empty-state";

export default function SuggestionsPage() {
  const { t } = useTranslation();
  const demand = useFarmerDemand();
  const itemName = useItemName();
  const list = demand.data ?? [];
  return (
    <>
      <PageHeader title={t("suggestions.title")} subtitle={t("suggestions.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label={t("suggestions.panelTitle")} className="flex min-w-0 flex-col gap-3">
          {demand.isLoading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)
          ) : list.length === 0 ? (
            <EmptyState icon={Inbox} title={t("suggestions.empty")} body={t("suggestions.emptyBody")} />
          ) : (
            list.map((d) => <DemandCard key={d.id} demand={d} name={itemName(d.item_id, d.item_name)} listHref={`/farmer/produce/new?demand=${d.id}`} />)
          )}
        </section>
        <aside className="flex flex-col gap-4">
          <TopRequested demand={list} />
        </aside>
      </div>
    </>
  );
}
