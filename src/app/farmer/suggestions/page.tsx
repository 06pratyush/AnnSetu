"use client";

import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFarmerSuggestions } from "@/lib/recommend/hooks";
import { Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/layout/app-shell";
import { DemandCard, TopRequested } from "@/components/domain/demand";
import { EmptyState } from "@/components/domain/empty-state";

export default function SuggestionsPage() {
  const { t } = useTranslation();
  const suggestions = useFarmerSuggestions();
  const list = suggestions.data ?? [];
  return (
    <>
      <PageHeader title={t("suggestions.title")} subtitle={t("suggestions.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label={t("suggestions.panelTitle")} className="flex min-w-0 flex-col gap-3">
          {suggestions.isLoading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)
          ) : list.length === 0 ? (
            <EmptyState icon={Inbox} title={t("suggestions.empty")} body={t("suggestions.emptyBody")} />
          ) : (
            list.map((s) =>
              s.demand ? <DemandCard key={s.id} demand={s.demand} reason={s.reason} listHref={`/farmer/produce/new?demand=${s.demand.id}`} /> : null,
            )
          )}
        </section>
        <aside className="flex flex-col gap-4">
          <TopRequested demand={suggestions.demand} />
        </aside>
      </div>
    </>
  );
}
