import "server-only";
import { ADVISORY_FEED, HOME_ISO, parseAdvisories, type Advisory } from "../lib/advisories.ts";
import { cityPoint } from "./geo.ts";

/** The feed, cached for 3 hours across requests (it changes a few times a week). */
export async function loadAdvisories(): Promise<Map<string, Advisory>> {
  try {
    const res = await fetch(ADVISORY_FEED, { next: { revalidate: 10_800 }, signal: AbortSignal.timeout(8000) });
    return res.ok ? parseAdvisories(await res.json()) : new Map();
  } catch {
    return new Map();
  }
}

/** ISO country code for a city. */
export async function countryOf(city: string): Promise<string | undefined> {
  return (await cityPoint(city))?.country;
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
