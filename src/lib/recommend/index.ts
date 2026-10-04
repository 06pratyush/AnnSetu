/**
 * Recommendation and matching hooks.
 *
 * This is where the project's own matching logic plugs in (who sees which listing, which demand
 * a farmer should act on). Nothing here ranks or filters yet: the defaults pass data through in
 * the order the database returns it (newest first).
 *
 * To add your logic, replace the two default implementations at the bottom of this file.
 * Both may be async, so they can also call a Postgres function (supabase.rpc) or an external API.
 * The pages call them through useRankedMarket / useFarmerSuggestions and need no other change.
 */
import type { ConsumerType, MarketListing, OpenDemand, Produce } from "@/lib/types";

/** What the marketplace knows about the person browsing. Anonymous visitors have only `anonymous: true`. */
export interface BuyerContext {
  anonymous: boolean;
  userId?: string;
  consumerType?: ConsumerType | null;
  lat?: number | null;
  lng?: number | null;
  district?: string | null;
  state?: string | null;
  /** Current UI filters, in case the ranking wants to respect them. */
  query?: string;
  category?: string;
}

/** What the suggestion panel knows about the farmer it is shown to. */
export interface FarmerContext {
  farmerId: string;
  lat?: number | null;
  lng?: number | null;
  district?: string | null;
  state?: string | null;
  mainCrops: string[];
  produce: Produce[];
}

/** One item in the farmer's suggestion panel. */
export interface Suggestion {
  id: string;
  kind: "demand";
  demand?: OpenDemand;
  /** Optional score from your logic, higher first. */
  score?: number;
  /** Optional one-line reason shown under the card, e.g. "12 km away". */
  reason?: string;
}

export type MarketRanker = (listings: MarketListing[], ctx: BuyerContext) => MarketListing[] | Promise<MarketListing[]>;
export type SuggestionProvider = (ctx: FarmerContext, openDemand: OpenDemand[]) => Suggestion[] | Promise<Suggestion[]>;

// ---------------------------------------------------------------------------------------------
// Default implementations: pass-through. Replace these with the project's matching logic.
// ---------------------------------------------------------------------------------------------

export const rankMarketplace: MarketRanker = (listings) => listings;

export const getFarmerSuggestions: SuggestionProvider = (_ctx, openDemand) =>
  openDemand.map((d) => ({ id: d.id, kind: "demand", demand: d }));
