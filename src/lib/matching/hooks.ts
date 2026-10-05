"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCatalogue, getEngineSettings } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-provider";
import { useLang } from "@/lib/i18n/provider";
import { useDefaultAddress } from "@/lib/queries";
import { SEED_CATALOGUE } from "./catalogue-data";
import { indexCatalogue, type CatalogueItem } from "./search";
import { DEFAULT_SETTINGS, settingsFromRow } from "./settings";

/** The item catalogue (from the database, or the bundled seed when offline) with a search index. */
export function useCatalogue() {
  const q = useQuery({
    queryKey: ["catalogue"],
    queryFn: getCatalogue,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const items: CatalogueItem[] = q.data && q.data.length ? q.data : SEED_CATALOGUE;
  return useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    return { items, byId, index: indexCatalogue(items), loading: q.isLoading };
  }, [items, q.isLoading]);
}

export function useEngineSettings() {
  const q = useQuery({ queryKey: ["engine-settings"], queryFn: getEngineSettings, staleTime: 10 * 60_000 });
  return useMemo(() => (q.data ? settingsFromRow(q.data) : DEFAULT_SETTINGS), [q.data]);
}

/** Item name in the current UI language, with the listing's own name as a fallback. */
export function useItemName() {
  const { lang } = useLang();
  const { byId } = useCatalogue();
  return (itemId: string | null | undefined, fallback = "") => {
    const item = itemId ? byId.get(itemId) : undefined;
    if (!item) return fallback;
    return lang === "hi" ? item.nameHi : item.nameEn;
  };
}

/** Who is asking: the signed-in buyer's type, saved location and distance limit, for matching. */
export function useBuyerContext() {
  const { profile } = useAuth();
  const address = useDefaultAddress();
  const settings = useEngineSettings();
  const a = profile ? address.data : null;
  const buyerType = profile?.role === "consumer" ? (profile.consumer_type ?? "individual") : null;
  const maxKm = profile?.buyer_details?.max_distance_km ?? null;
  return {
    ready: !profile || !address.isLoading,
    buyerType,
    maxKm,
    effectiveMaxKm: maxKm ?? (buyerType === "industrial" ? settings.businessMaxKm : settings.householdMaxKm),
    lat: a?.lat ?? null,
    lng: a?.lng ?? null,
    state: a?.state ?? null,
    district: a?.district ?? null,
    pincode: a?.pincode ?? null,
  };
}
