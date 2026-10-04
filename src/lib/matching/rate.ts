// Step 5, rate: a suggested price per base unit between what the mandi would pay the farmer and
// what the shop would charge the buyer, with every move shown so the farmer can see why.
import type { EngineSettings } from "./settings";

export interface RateInputs {
  /** What the mandi pays the farmer, per base unit (the lowest fair price). */
  mandi: number;
  /** What the local shop charges the buyer, per base unit. */
  shop: number;
  /** One delivery run there and back, rupees. */
  tripCost: number;
  /** Units carried on that run. */
  tripQty: number;
  /** Units wanted nearby (open requests) and units on offer nearby (active listings). */
  demandQty: number;
  supplyQty: number;
  /** Number of open requests behind demandQty; the nudge waits for enough of them. */
  demandRequests: number;
  /** Product of area demand rules for today (festivals etc.), 1 when none. */
  demandMultiplier: number;
  /** Share of shelf life still left, 0..1. */
  lifeLeft: number;
}

export type RateStep =
  | { key: "lowest"; value: number }
  | { key: "deliveryPerUnit"; value: number }
  | { key: "highest"; value: number }
  | { key: "room"; value: number }
  | { key: "start"; value: number }
  | { key: "nudge"; value: number; active: boolean }
  | { key: "ageing"; value: number; factor: number }
  | { key: "bigLot"; value: number; cut: number }
  | { key: "final"; value: number };

export type RateSuggestion =
  | { ok: true; price: number; lowest: number; highest: number; steps: RateStep[] }
  | { ok: false; reason: "no_room"; lowest: number; highest: number; breakEvenQty: number; steps: RateStep[] };

const r2 = (x: number) => Math.round(x * 100) / 100;

export function suggestRate(i: RateInputs, s: Pick<EngineSettings, "farmerShare" | "nudgeCap" | "nudgeMinRequests" | "lotCutPer100" | "lotCutMax">): RateSuggestion {
  const steps: RateStep[] = [];
  const lowest = i.mandi;
  steps.push({ key: "lowest", value: lowest });
  const deliveryPerUnit = i.tripQty > 0 ? i.tripCost / i.tripQty : Infinity;
  steps.push({ key: "deliveryPerUnit", value: deliveryPerUnit });
  const highest = i.shop - deliveryPerUnit;
  steps.push({ key: "highest", value: highest });
  const room = highest - lowest;
  steps.push({ key: "room", value: room });
  if (!(room > 0)) {
    const gap = i.shop - i.mandi;
    return { ok: false, reason: "no_room", lowest, highest, breakEvenQty: gap > 0 ? i.tripCost / gap : Infinity, steps };
  }

  let price = lowest + s.farmerShare * room;
  steps.push({ key: "start", value: price });

  // Demand nudge: scarce goods are worth more, a glut less; capped at a quarter of the room.
  const cap = s.nudgeCap * room;
  const active = i.demandRequests >= s.nudgeMinRequests && i.supplyQty > 0;
  const nudge = active ? Math.max(-cap, Math.min(cap, ((i.demandQty * i.demandMultiplier) / i.supplyQty - 1) * cap)) : 0;
  price += nudge;
  steps.push({ key: "nudge", value: nudge, active });

  // Ageing: with less than half the shelf life left, shrink the part above the lowest fair price.
  const factor = i.lifeLeft < 0.5 ? Math.max(0, i.lifeLeft) / 0.5 : 1;
  price = lowest + (price - lowest) * factor;
  steps.push({ key: "ageing", value: price, factor });

  // Big lot: 5% off per 100 units carried, at most 5%.
  const cut = Math.min(s.lotCutMax, (s.lotCutPer100 * i.tripQty) / 100);
  price = price * (1 - cut);
  steps.push({ key: "bigLot", value: price, cut });

  const final = r2(Math.min(highest, Math.max(lowest, price)));
  steps.push({ key: "final", value: final });
  return { ok: true, price: final, lowest, highest, steps };
}

/** Smallest load for which a trip pays for itself: trip cost / (shop - mandi). */
export function breakEvenQty(tripCostRs: number, shop: number, mandi: number): number {
  const gap = shop - mandi;
  return gap > 0 ? tripCostRs / gap : Infinity;
}
