import "server-only";
import { ADVISORY_FEED, COUNTRY_ISO, HOME_ISO, parseAdvisories, type Advisory } from "../lib/advisories.ts";
import { findDestination } from "../lib/destinations.ts";

const GEOCODE = process.env.OPEN_METEO_API_KEY ? "https://customer-geocoding-api.open-meteo.com/v1/search" : "https://geocoding-api.open-meteo.com/v1/search";

/** The feed, cached for 3 hours across requests (it changes a few times a week). */
export async function loadAdvisories(): Promise<Map<string, Advisory>> {
  try {
    const res = await fetch(ADVISORY_FEED, { next: { revalidate: 10_800 }, signal: AbortSignal.timeout(8000) });
    return res.ok ? parseAdvisories(await res.json()) : new Map();
  } catch {
    return new Map();
  }
}

/** ISO country code for a city: the catalog first, then Open-Meteo's geocoder. */
export async function countryOf(city: string): Promise<string | undefined> {
  const d = findDestination(city);
  if (d) return COUNTRY_ISO[d.country];
  try {
    const url = new URL(GEOCODE);
    url.searchParams.set("name", city);
    url.searchParams.set("count", "1");
    if (process.env.OPEN_METEO_API_KEY) url.searchParams.set("apikey", process.env.OPEN_METEO_API_KEY);
    const res = await fetch(url, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return undefined;
    const code = ((await res.json()) as { results?: { country_code?: string }[] }).results?.[0]?.country_code;
    return code && /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : undefined;
  } catch {
    return undefined;
  }
}

/** Advice for the countries a list of cities is in (one entry per country, home excluded). */
export async function advisoriesFor(cities: string[]): Promise<(Advisory & { cities: string[] })[]> {
  const [feed, codes] = await Promise.all([loadAdvisories(), Promise.all(cities.map(countryOf))]);
  const byIso = new Map<string, Advisory & { cities: string[] }>();
  cities.forEach((city, i) => {
    const iso = codes[i];
    const a = iso && iso !== HOME_ISO ? feed.get(iso) : undefined;
    if (!a) return;
    const entry = byIso.get(a.iso) ?? { ...a, cities: [] };
    if (!entry.cities.includes(city)) entry.cities.push(city);
    byIso.set(a.iso, entry);
  });
  return [...byIso.values()];
}
