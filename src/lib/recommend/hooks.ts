"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-provider";
import { useDefaultAddress, useMyProduce, useOpenDemand } from "@/lib/queries";
import type { MarketListing } from "@/lib/types";
import { getFarmerSuggestions, rankMarketplace, type BuyerContext } from "./index";

/** Runs the farmer's suggestion provider over open demand. Re-runs when demand or stock changes. */
export function useFarmerSuggestions() {
  const { profile } = useAuth();
  const demand = useOpenDemand();
  const produce = useMyProduce();
  const address = useDefaultAddress();
  const ready = Boolean(profile) && demand.isSuccess && produce.isSuccess && !address.isLoading;
  const query = useQuery({
    queryKey: ["suggestions", profile?.id, demand.dataUpdatedAt, produce.dataUpdatedAt, address.dataUpdatedAt],
    enabled: ready,
    queryFn: () =>
      getFarmerSuggestions(
        {
          farmerId: profile!.id,
          lat: address.data?.lat,
          lng: address.data?.lng,
          district: address.data?.district,
          state: address.data?.state,
          mainCrops: profile!.farmer_details?.main_crops ?? [],
          produce: produce.data ?? [],
        },
        demand.data ?? [],
      ),
  });
  return { ...query, isLoading: !ready || query.isLoading, demand: demand.data ?? [] };
}

/** Runs the marketplace ranker over the listings the current filters returned. */
export function useRankedMarket(listings: MarketListing[] | undefined, filters: { query: string; category: string }, dataVersion: number) {
  const { profile } = useAuth();
  const address = useDefaultAddress();
  const ctx: BuyerContext = {
    anonymous: !profile,
    userId: profile?.id,
    consumerType: profile?.consumer_type,
    lat: address.data?.lat,
    lng: address.data?.lng,
    district: address.data?.district,
    state: address.data?.state,
    query: filters.query,
    category: filters.category,
  };
  return useQuery({
    queryKey: ["ranked-market", profile?.id ?? "anon", dataVersion, address.dataUpdatedAt],
    enabled: Boolean(listings),
    queryFn: () => rankMarketplace(listings ?? [], ctx),
    placeholderData: (prev) => prev,
  });
}
