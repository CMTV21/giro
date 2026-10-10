import "server-only";
import { COUNTRY_ISO } from "../lib/advisories.ts";
import { findDestination } from "../lib/destinations.ts";

const GEOCODE = () => (process.env.OPEN_METEO_API_KEY ? "https://customer-geocoding-api.open-meteo.com/v1/search" : "https://geocoding-api.open-meteo.com/v1/search");

export interface CityPoint {
  lat: number;
  lon: number;
  /** ISO 3166 alpha-2. */
  country?: string;
}

/** Where a city is: the catalog first, then Open-Meteo's geocoder (cached a day by Next's fetch cache). */
export async function cityPoint(city: string): Promise<CityPoint | undefined> {
  const d = findDestination(city);
  if (d && Number.isFinite(d.lat)) return { lat: d.lat, lon: d.lon, country: COUNTRY_ISO[d.country] };
  try {
    const url = new URL(GEOCODE());
    url.searchParams.set("name", city);
    url.searchParams.set("count", "1");
    if (process.env.OPEN_METEO_API_KEY) url.searchParams.set("apikey", process.env.OPEN_METEO_API_KEY);
    const res = await fetch(url, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return undefined;
    const hit = ((await res.json()) as { results?: { latitude?: number; longitude?: number; country_code?: string }[] }).results?.[0];
    if (typeof hit?.latitude !== "number" || typeof hit.longitude !== "number") return undefined;
    const code = hit.country_code && /^[A-Za-z]{2}$/.test(hit.country_code) ? hit.country_code.toUpperCase() : undefined;
    return { lat: hit.latitude, lon: hit.longitude, country: code };
  } catch {
    return undefined;
  }
}
