"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LocateFixed, SearchX, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { isDemo } from "@/lib/supabase";
import { matchHidden, matchListings, type MatchParams } from "@/lib/api";
import { getCurrentPosition, reverseGeocode, type LatLng } from "@/lib/geo";
import { useFormat } from "@/lib/i18n/format";
import { useLang } from "@/lib/i18n/provider";
import { useBuyerContext, useCatalogue, useEngineSettings } from "@/lib/matching/hooks";
import { searchCatalogue, type CatalogueItem } from "@/lib/matching/search";
import type { CategorySlug } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/domain/empty-state";
import { CategoryChips, SearchFilterBar, type MarketSort } from "@/components/domain/market";
import { HiddenNote, MatchCard } from "@/components/domain/matching";
import { UnitInput } from "@/components/ui/input";

/** Demo mode: make sure there are demo farms near where the visitor is (their area, if Nominatim knows it). */
async function addDemoFarmsNear(p: LatLng, lang: "en" | "hi") {
  const where = await reverseGeocode(p, lang).catch(() => ({}) as Awaited<ReturnType<typeof reverseGeocode>>);
  const pin = /^[0-9]{6}$/.test(where.pincode ?? "") ? where.pincode! : "000000";
  const { addDemoNeighbours } = await import("@/lib/demo/neighbours");
  await addDemoNeighbours({ lat: p.lat, lng: p.lng, district: where.district ?? "", state: where.state ?? "", pincode: pin }).catch(() => {});
}

const PAGE = 24;

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
  const f = useFormat();
  const { lang } = useLang();
  const { profile } = useAuth();
  const buyer = useBuyerContext();
  const settings = useEngineSettings();
  const { index, byId } = useCatalogue();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<CatalogueItem | null>(null);
  const [qty, setQty] = useState("");
  const [category, setCategory] = useState<CategorySlug | "all">("all");
  const [sort, setSort] = useState<MarketSort>("newest");
  const [organic, setOrganic] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const q = useDebounced(search, 250);

  // Step 1: what the buyer typed becomes a catalogue item. Exact names apply at once;
  // anything else is offered as "did you mean".
  const found = useMemo(() => searchCatalogue(index, q, settings.searchCutoff, 3), [index, q, settings.searchCutoff]);
  const item = picked ?? (found.hits[0]?.exact ? found.hits[0].item : null);
  const quantity = item && Number(qty) > 0 ? Number(qty) : null;
  const lat = buyer.lat ?? here?.lat ?? null;
  const lng = buyer.lng ?? here?.lng ?? null;
  const pooled = buyer.buyerType !== "industrial";

  const params: MatchParams = {
    itemId: item?.id ?? null,
    quantity,
    lat,
    lng,
    buyerType: buyer.buyerType,
    maxKm: buyer.maxKm,
    state: buyer.state,
    district: buyer.district,
    category: item || category === "all" ? null : category,
    organic,
    limit,
  };
  const results = useQuery({
    queryKey: ["match", params],
    queryFn: () => matchListings(params),
    enabled: buyer.ready,
    placeholderData: keepPreviousData,
  });
  const hidden = useQuery({ queryKey: ["match-hidden", params], queryFn: () => matchHidden(params), enabled: Boolean(item) && buyer.ready });

  const rows = useMemo(() => {
    const list = [...(results.data ?? [])];
    if (sort === "price_asc") list.sort((a, b) => a.price_base - b.price_base);
    if (sort === "price_desc") list.sort((a, b) => b.price_base - a.price_base);
    return list;
  }, [results.data, sort]);
  const total = results.data?.[0]?.total_count ?? 0;
  const weights = buyer.buyerType === "industrial" ? settings.wBusiness : settings.wHousehold;
  const itemLabel = (i: CatalogueItem) => (lang === "hi" ? i.nameHi : i.nameEn);

  async function locateMe() {
    setLocating(true);
    try {
      const p = await getCurrentPosition();
      if (isDemo) await addDemoFarmsNear(p, lang);
      setHere({ lat: p.lat, lng: p.lng });
    } catch {
      /* the list still works without a location, just without distance rules */
    } finally {
      setLocating(false);
    }
  }

  return (
    <>
      <PageHeader title={t("market.title")} subtitle={t("matching.marketSubtitle")} />
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
            setPicked(null);
            setLimit(PAGE);
          }}
          sort={sort}
          onSort={setSort}
          organic={organic}
          onOrganic={setOrganic}
          sortLabels={{ newest: t("matching.bestMatch") }}
        />

        {q && !item && found.hits.length ? (
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            <span className="text-small text-ink-muted">{t("matching.didYouMean")}</span>
            {found.hits.map((h) => (
              <Button key={h.item.id} variant="outline" size="sm" onClick={() => setPicked(h.item)}>
                {itemLabel(h.item)}
              </Button>
            ))}
          </div>
        ) : null}

        {item ? (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-small text-ink-muted">{t("matching.showingFor")}</p>
              <p className="font-display text-h3 font-semibold text-ink">
                {itemLabel(item)} <span className="font-body text-body font-normal text-ink-muted">· {lang === "hi" ? item.nameEn : item.nameHi}</span>
              </p>
            </div>
            <label className="flex flex-col gap-1 text-small font-semibold text-ink sm:w-56">
              {t("matching.howMuch")}
              <UnitInput unit={f.unit(item.baseUnit)} value={qty} onChange={(e) => setQty(e.target.value)} min={0} step="any" placeholder={t("common.optional")} />
            </label>
            {picked ? (
              <Button variant="ghost" onClick={() => { setPicked(null); setSearch(""); }}>
                {t("common.clear")}
              </Button>
            ) : null}
          </div>
        ) : (
          <CategoryChips
            value={category}
            onChange={(c) => {
              setCategory(c);
              setLimit(PAGE);
            }}
          />
        )}

        <div className="flex flex-wrap items-center gap-3 text-small text-ink-muted">
          {lat === null ? (
            <Button variant="secondary" size="sm" onClick={locateMe} loading={locating}>
              {locating ? null : <LocateFixed aria-hidden />}
              {t("matching.useLocation")}
            </Button>
          ) : (
            <span>{t("matching.withinKm", { km: f.number(buyer.effectiveMaxKm) })}</span>
          )}
          {pooled && lat !== null ? (
            <span className="flex items-center gap-1">
              <Users className="size-4" aria-hidden />
              {t("matching.sharedDelivery")}
            </span>
          ) : null}
        </div>
      </div>

      <p className="mb-3 text-small text-ink-muted" aria-live="polite">
        {results.isSuccess ? t("market.results", { count: total }) : " "}
      </p>
      {hidden.data?.length ? <HiddenNote hidden={hidden.data} className="mb-4" /> : null}

      {results.isLoading ? (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      ) : results.isError ? (
        <Alert tone="danger" action={<Button variant="secondary" size="sm" onClick={() => void results.refetch()}>{t("common.retry")}</Button>}>
          {t("errors.network")}
        </Alert>
      ) : rows.length === 0 ? (
        <EmptyState icon={SearchX} title={t("market.empty")} body={item ? t("matching.emptyForItem") : t("market.emptyBody")} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((r) => {
              const it = byId.get(r.item_id);
              const factor = r.price_base > 0 ? r.price_per_unit / r.price_base : 1;
              return (
                <MatchCard
                  key={r.id}
                  row={r}
                  href={`/market/product?id=${r.id}${quantity ? `&qty=${quantity / factor}` : ""}`}
                  name={it ? itemLabel(it) : r.name}
                  quantity={quantity ? quantity / factor : null}
                  pooled={pooled}
                  weights={weights}
                />
              );
            })}
          </div>
          {rows.length < total ? (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" loading={results.isFetching} onClick={() => setLimit((n) => n + PAGE)}>
                {t("market.loadMore")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
