import type { Interest } from "./types.ts";

/** Concerts, games and shows on during a trip (Ticketmaster Discovery API). */

export interface TripEvent {
  id: string;
  name: string;
  date: string;
  /** "HH:MM" local, when announced. */
  time?: string;
  venue?: string;
  /** Ticketmaster's segment: Music, Sports, Arts & Theatre, Family… */
  segment?: string;
  genre?: string;
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  url: string;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() && v !== "Undefined" ? v.trim() : undefined);

export function parseEvents(json: unknown): TripEvent[] {
  const events = (json as { _embedded?: { events?: unknown[] } })?._embedded?.events ?? [];
  const out: TripEvent[] = [];
  for (const raw of events) {
    const e = raw as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const id = text(e?.id);
    const name = text(e?.name);
    const url = text(e?.url);
    const date = text(e?.dates?.start?.localDate);
    if (!id || !name || !url || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (e.dates?.status?.code === "cancelled" || e.dates?.status?.code === "postponed") continue;
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" || !/(^|\.)(ticketmaster\.[a-z.]+|livenation\.com)$/.test(u.hostname)) continue;
    } catch {
      continue;
    }
    const time = text(e.dates?.start?.localTime)?.slice(0, 5);
    const c = Array.isArray(e.classifications) ? e.classifications[0] : undefined;
    const price = Array.isArray(e.priceRanges) ? e.priceRanges[0] : undefined;
    out.push({
      id,
      name: name.slice(0, 160),
      date,
      time: time && /^\d{2}:\d{2}$/.test(time) ? time : undefined,
      venue: text(e._embedded?.venues?.[0]?.name)?.slice(0, 120),
      segment: text(c?.segment?.name),
      genre: text(c?.genre?.name),
      priceMin: typeof price?.min === "number" ? price.min : undefined,
      priceMax: typeof price?.max === "number" ? price.max : undefined,
      currency: text(price?.currency),
      url,
    });
  }
  // One listing per show and day (tours list many identical dates).
  const seen = new Set<string>();
  return out.filter((e) => {
    const k = `${e.name.toLowerCase()}|${e.date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Which plan category an event becomes when added to a day. */
export function eventCategory(e: Pick<TripEvent, "segment" | "genre">): Interest {
  const s = `${e.segment ?? ""} ${e.genre ?? ""}`.toLowerCase();
  if (/sport/.test(s)) return "adventure";
  if (/family/.test(s)) return "family";
  if (/theatre|art|comedy|dance|opera|classical/.test(s)) return "art";
  if (/music|concert|rock|pop|jazz/.test(s)) return "nightlife";
  return "culture";
}
