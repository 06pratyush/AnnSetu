import type { Unit } from "../types";

export type BaseUnit = "kg" | "litre" | "piece" | "dozen";

/** How many base units one selling unit holds, or null when the two don't convert. Same as public.unit_factor. */
export function unitFactor(unit: Unit, base: BaseUnit): number | null {
  switch (base) {
    case "kg":
      return unit === "kg" ? 1 : unit === "quintal" ? 100 : unit === "tonne" ? 1000 : null;
    case "litre":
      return unit === "litre" ? 1 : null;
    case "piece":
      return unit === "piece" ? 1 : unit === "dozen" ? 12 : null;
    case "dozen":
      return unit === "dozen" ? 1 : null;
  }
}

/** Selling units a farmer may choose for an item with this base unit. */
export function unitsFor(base: BaseUnit): Unit[] {
  switch (base) {
    case "kg":
      return ["kg", "quintal", "tonne"];
    case "litre":
      return ["litre"];
    case "piece":
      return ["piece", "dozen"];
    case "dozen":
      return ["dozen"];
  }
}
