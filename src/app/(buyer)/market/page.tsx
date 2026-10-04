"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { ConfigMissing } from "@/lib/auth/role-guard";
import { listMarket, MARKET_PAGE_SIZE, type MarketQuery } from "@/lib/api";
import { keys } from "@/lib/queries";
import { useRankedMarket } from "@/lib/recommend/hooks";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { CategorySlug } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/domain/empty-state";
import { CategoryChips, SearchFilterBar, type MarketSort } from "@/components/domain/market";
import { ProduceCard } from "@/components/domain/produce";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function MarketPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [category, setCategory] = useState<CategorySlug | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<MarketSort>("newest");
  const [organic, setOrganic] = useState(false);
  const [limit, setLimit] = useState(MARKET_PAGE_SIZE);
  const q = useDebounced(search, 300);

  const mq: MarketQuery = { category, q, organic, sort, limit };
  const market = useQuery({
    queryKey: keys.market(mq),
    queryFn: () => listMarket(mq),
    enabled: isSupabaseConfigured,
    placeholderData: keepPreviousData,
  });
  const ranked = useRankedMarket(market.data?.rows, { query: q, category }, market.dataUpdatedAt);
  const listings = ranked.data ?? market.data?.rows ?? [];
  const total = market.data?.count ?? 0;

  if (!isSupabaseConfigured) return <ConfigMissing />;

  return (
    <>
      <PageHeader title={t("market.title")} subtitle={t("market.subtitle")} />
      {profile?.role === "farmer" ? (
        <Alert tone="info" className="mb-4">
          {t("market.farmerViewing")}
        </Alert>
      ) : null}

      <div className="mb-6 flex flex-col gap-4">
        <SearchFilterBar
          query={search}
          onQuery={(v) => {
            setSearch(v);
            setLimit(MARKET_PAGE_SIZE);
          }}
          sort={sort}
          onSort={setSort}
          organic={organic}
          onOrganic={setOrganic}
        />
        <CategoryChips
          value={category}
          onChange={(c) => {
            setCategory(c);
            setLimit(MARKET_PAGE_SIZE);
          }}
        />
      </div>

      <p className="mb-3 text-small text-ink-muted" aria-live="polite">
        {market.isSuccess ? t("market.results", { count: total }) : " "}
      </p>

      {market.isLoading ? (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : market.isError ? (
        <Alert tone="danger" action={<Button variant="secondary" size="sm" onClick={() => void market.refetch()}>{t("common.retry")}</Button>}>
          {t("errors.network")}
        </Alert>
      ) : listings.length === 0 ? (
        <EmptyState icon={SearchX} title={t("market.empty")} body={t("market.emptyBody")} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((l) => (
              <ProduceCard key={l.id} listing={l} href={`/market/product?id=${l.id}`} />
            ))}
          </div>
          {listings.length < total ? (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" loading={market.isFetching} onClick={() => setLimit((n) => n + MARKET_PAGE_SIZE)}>
                {t("market.loadMore")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
