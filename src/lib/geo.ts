import type { AddressInput } from "./types";

export type LatLng = { lat: number; lng: number };

export type GeoError = "denied" | "unavailable";

/** Browser GPS. Resolves with position and accuracy in metres. */
export function getCurrentPosition(): Promise<LatLng & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject("unavailable" satisfies GeoError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (err) => reject((err.code === err.PERMISSION_DENIED ? "denied" : "unavailable") satisfies GeoError),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

type NominatimAddress = Record<string, string | undefined>;

/**
 * Reverse-geocodes a point with OpenStreetMap Nominatim (free; one request per user action,
 * within the 1 request/second usage policy). Returns whatever address parts it could find.
 */
export async function reverseGeocode({ lat, lng }: LatLng, lang: "en" | "hi"): Promise<Partial<AddressInput>> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", lat.toFixed(6));
  url.searchParams.set("lon", lng.toFixed(6));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", lang === "hi" ? "hi,en" : "en");
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const data = (await res.json()) as { address?: NominatimAddress };
  const a = data.address ?? {};
  const line1 = [a.house_number, a.road ?? a.hamlet].filter(Boolean).join(", ");
  return {
    line1: line1 || undefined,
    line2: a.neighbourhood ?? a.suburb ?? a.quarter ?? undefined,
    village_city: a.village ?? a.town ?? a.city ?? a.municipality ?? a.hamlet ?? undefined,
    district: a.state_district ?? a.county ?? a.city_district ?? undefined,
    state: a.state ?? undefined,
    pincode: a.postcode?.replace(/\s/g, "").slice(0, 6) ?? undefined,
    lat,
    lng,
  };
}

/** Centre of India, for an empty map. */
export const INDIA_CENTER: LatLng = { lat: 22.5, lng: 79 };
