"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth/auth-provider";
import * as api from "./api";
import type { MarketQuery } from "./api";

/** Query keys in one place so mutations can invalidate exactly what changed. */
export const keys = {
  myProduce: (uid?: string) => ["my-produce", uid] as const,
  produce: (id?: string | null) => ["produce", id] as const,
  ledger: (id?: string | null) => ["ledger", id] as const,
  farmerOrders: (uid?: string) => ["farmer-orders", uid] as const,
  buyerOrders: (uid?: string) => ["buyer-orders", uid] as const,
  openDemand: ["open-demand"] as const,
  myDemand: (uid?: string) => ["my-demand", uid] as const,
  market: (q: MarketQuery) => ["market", q] as const,
  listing: (id?: string | null) => ["listing", id] as const,
  farmerPublic: (id?: string | null) => ["farmer-public", id] as const,
  farmerListings: (id?: string | null) => ["farmer-listings", id] as const,
  farmerReviews: (id?: string | null) => ["farmer-reviews", id] as const,
  address: (uid?: string) => ["address", uid] as const,
};

export function useMyProduce() {
  const { profile } = useAuth();
  return useQuery({ queryKey: keys.myProduce(profile?.id), queryFn: () => api.listMyProduce(profile!.id), enabled: Boolean(profile) });
}

export function useProduce(id: string | null) {
  return useQuery({ queryKey: keys.produce(id), queryFn: () => api.getProduce(id!), enabled: Boolean(id) });
}

export function useLedger(id: string | null) {
  return useQuery({ queryKey: keys.ledger(id), queryFn: () => api.listLedger(id!), enabled: Boolean(id) });
}

export function useFarmerOrders() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: keys.farmerOrders(profile?.id),
    queryFn: () => api.listFarmerOrders(profile!.id),
    enabled: Boolean(profile && profile.role === "farmer"),
  });
}

export function useBuyerOrders() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: keys.buyerOrders(profile?.id),
    queryFn: () => api.listBuyerOrders(profile!.id),
    enabled: Boolean(profile && profile.role === "consumer"),
  });
}

export function useOpenDemand() {
  const { profile } = useAuth();
  return useQuery({ queryKey: keys.openDemand, queryFn: api.listOpenDemand, enabled: Boolean(profile) });
}

/** Open buyer requests mapped to this farm: reachable and stock-ready ones first. */
export function useFarmerDemand() {
  const { profile } = useAuth();
  return useQuery({ queryKey: ["farmer-demand", profile?.id], queryFn: api.listDemandForFarmer, enabled: Boolean(profile && profile.role === "farmer") });
}

export function useMyDemand() {
  const { profile } = useAuth();
  return useQuery({ queryKey: keys.myDemand(profile?.id), queryFn: () => api.listMyDemand(profile!.id), enabled: Boolean(profile) });
}

export function useDefaultAddress() {
  const { profile } = useAuth();
  return useQuery({ queryKey: keys.address(profile?.id), queryFn: () => api.getDefaultAddress(profile!.id), enabled: Boolean(profile) });
}

export function useListing(id: string | null) {
  return useQuery({ queryKey: keys.listing(id), queryFn: () => api.getListing(id!), enabled: Boolean(id) });
}

export function useFarmerPublic(id: string | null) {
  return useQuery({ queryKey: keys.farmerPublic(id), queryFn: () => api.getFarmerPublic(id!), enabled: Boolean(id) });
}

export function useFarmerListings(id: string | null) {
  return useQuery({ queryKey: keys.farmerListings(id), queryFn: () => api.listFarmerListings(id!), enabled: Boolean(id) });
}

export function useFarmerReviews(id: string | null) {
  return useQuery({ queryKey: keys.farmerReviews(id), queryFn: () => api.listFarmerReviews(id!), enabled: Boolean(id) });
}
