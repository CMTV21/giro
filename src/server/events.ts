import "server-only";
import { parseEvents, type TripEvent } from "../lib/events.ts";
import { cached } from "./cache.ts";
import { cityPoint } from "./geo.ts";

/** Events near a city on given dates (Ticketmaster Discovery API, free key). Cached 6 hours. Off without TICKETMASTER_API_KEY. */

export const eventsEnabled = () => Boolean(process.env.TICKETMASTER_API_KEY?.trim());

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export async function eventsFor(city: string, start: string, end: string, get: Fetcher = fetch): Promise<TripEvent[]> {
  if (!eventsEnabled()) return [];
  const at = await cityPoint(city);
  if (!at) return [];
  const found = await cached(`events|${at.lat.toFixed(2)},${at.lon.toFixed(2)}|${start}|${end}`, 360, async () => {
    const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
    url.searchParams.set("apikey", process.env.TICKETMASTER_API_KEY!.trim());
    url.searchParams.set("latlong", `${at.lat.toFixed(4)},${at.lon.toFixed(4)}`);
    url.searchParams.set("radius", "25");
    url.searchParams.set("unit", "km");
    url.searchParams.set("startDateTime", `${start}T00:00:00Z`);
    url.searchParams.set("endDateTime", `${end}T23:59:59Z`);
    url.searchParams.set("sort", "relevance,desc");
    url.searchParams.set("size", "60");
    const res = await get(url.toString(), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`events ${res.status}`);
    return parseEvents(await res.json());
  });
  return (found ?? []).filter((e) => e.date >= start && e.date <= end);
}
