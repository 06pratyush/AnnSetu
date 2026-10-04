import type { EngineSettings } from "./settings";

const EARTH_RADIUS_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Straight-line (great-circle) distance in km. Same formula as public.geo_km in SQL. */
export function geoKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Travel hours = straight-line km x road factor / speed. */
export function travelHours(km: number, s: Pick<EngineSettings, "roadFactor" | "speedKmph">): number {
  return (km * s.roadFactor) / s.speedKmph;
}

/** One delivery run there and back by road. */
export function tripCost(km: number, s: Pick<EngineSettings, "roadFactor" | "costPerRoadKm">): number {
  return 2 * km * s.roadFactor * s.costPerRoadKm;
}
