import "server-only";
import { normalizeCity } from "../lib/destinations.ts";
import { parseGoogleHours, type OpeningHours } from "../lib/hours.ts";
import { takeMonthlyQuota } from "./cache.ts";
import { getDb } from "./db.ts";

/**
 * Google Places (New): place IDs, live details (opening hours, rating, address) and photos.
 *
 * Google's Places policies forbid storing Places content except the place ID, so only IDs are kept
 * (in `place_ids`); everything else is fetched live per request. Finding an ID uses the free
 * "IDs only" Text Search. Paid calls are capped per calendar month:
 *  - details (opening hours, rating…): GOOGLE_PLACES_MONTHLY_CAP, default 900
 *  - photos: GOOGLE_PHOTOS_MONTHLY_CAP, default 900
 * Off unless GOOGLE_PLACES_API_KEY is set.
 */

export const placesEnabled = () => Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());

const API = "https://places.googleapis.com/v1";
const MISS_DAYS = 7;
const DEFAULT_CAP = 900;

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export const placeKey = (title: string, city: string) => `${normalizeCity(title)}|${normalizeCity(city)}`.slice(0, 240);

function capFrom(name: string): number {
  const raw = process.env[name]?.trim();
  const n = raw ? Number(raw) : DEFAULT_CAP;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_CAP;
}
export const detailsCap = () => capFrom("GOOGLE_PLACES_MONTHLY_CAP");
export const photosCap = () => capFrom("GOOGLE_PHOTOS_MONTHLY_CAP");

function headers(fieldMask?: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json", "x-goog-api-key": process.env.GOOGLE_PLACES_API_KEY!.trim() };
  if (fieldMask) h["x-goog-fieldmask"] = fieldMask;
  return h;
}
const validId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{10,300}$/.test(id);

/** A Google Maps link for a place (built from its ID, so nothing from Google is stored). */
export const mapsUrlFor = (placeId: string, title: string) =>
  `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: title, query_place_id: placeId })}`;

/** The Google place ID for a stop, looked up once (free "IDs only" search) and kept. */
export async function placeIdFor(title: string, city: string, get: Fetcher = fetch): Promise<string | undefined> {
  const db = await getDb();
  const key = placeKey(title, city);
  const [row] = await db.query<{ place_id: string | null; age_days: number }>(
    "select place_id, extract(epoch from now() - fetched_at) / 86400 as age_days from place_ids where key = $1",
    [key],
  );
  if (row && (row.place_id || Number(row.age_days) < MISS_DAYS)) return row.place_id ?? undefined;
  if (!placesEnabled()) return undefined;
  try {
    const res = await get(`${API}/places:searchText`, {
      method: "POST",
      headers: headers("places.id"),
      body: JSON.stringify({ textQuery: `${title}, ${city}`, pageSize: 1 }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`places search ${res.status}`);
    const id = ((await res.json()) as { places?: { id?: unknown }[] }).places?.[0]?.id;
    const placeId = validId(id) ? id : null;
    await db.query(
      "insert into place_ids (key, place_id) values ($1, $2) on conflict (key) do update set place_id = excluded.place_id, fetched_at = now()",
      [key, placeId],
    );
    return placeId ?? undefined;
  } catch (err) {
    console.error("place id lookup failed", err instanceof Error ? err.message : err);
    return undefined;
  }
}

export interface PlaceDetails {
  placeId: string;
  name?: string;
  address?: string;
  rating?: number;
  ratingCount?: number;
  /** 1 (inexpensive) to 4 (very expensive). */
  priceLevel?: number;
  website?: string;
  mapsUrl: string;
  hours?: OpeningHours;
  /** Google's own weekly lines, e.g. "Monday: 9:00 AM – 6:00 PM". */
  weekdays?: string[];
}

const PRICE: Record<string, number> = { PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };
const DETAIL_FIELDS = "id,displayName,formattedAddress,rating,userRatingCount,priceLevel,websiteUri,regularOpeningHours,businessStatus";
const HOURS_FIELDS = "id,regularOpeningHours,businessStatus";

export function parseDetails(raw: unknown, placeId: string, title: string): PlaceDetails {
  const p = (raw ?? {}) as {
    displayName?: { text?: unknown };
    formattedAddress?: unknown;
    rating?: unknown;
    userRatingCount?: unknown;
    priceLevel?: unknown;
    websiteUri?: unknown;
    regularOpeningHours?: { weekdayDescriptions?: unknown };
  };
  const str = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  const website = str(p.websiteUri, 500);
  const weekdays = Array.isArray(p.regularOpeningHours?.weekdayDescriptions) ? p.regularOpeningHours.weekdayDescriptions.filter((d): d is string => typeof d === "string").slice(0, 7) : undefined;
  return {
    placeId,
    name: str(p.displayName?.text, 160),
    address: str(p.formattedAddress),
    rating: typeof p.rating === "number" && p.rating >= 1 && p.rating <= 5 ? Math.round(p.rating * 10) / 10 : undefined,
    ratingCount: typeof p.userRatingCount === "number" && p.userRatingCount >= 0 ? Math.floor(p.userRatingCount) : undefined,
    priceLevel: typeof p.priceLevel === "string" ? PRICE[p.priceLevel] : undefined,
    website: website && /^https?:\/\//.test(website) ? website : undefined,
    mapsUrl: mapsUrlFor(placeId, title),
    hours: parseGoogleHours(raw),
    weekdays: weekdays?.length ? weekdays : undefined,
  };
}

async function fetchPlace(placeId: string, fields: string, get: Fetcher): Promise<unknown> {
  const res = await get(`${API}/places/${encodeURIComponent(placeId)}?languageCode=en`, { method: "GET", headers: headers(fields), signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`place details ${res.status}`);
  return res.json();
}

/** Live details for the details panel. One capped call; undefined when off, unknown or over the cap. */
export async function placeDetails(title: string, city: string, get: Fetcher = fetch): Promise<PlaceDetails | undefined> {
  const placeId = await placeIdFor(title, city, get);
  if (!placeId || !(await takeMonthlyQuota("google-places", detailsCap()))) return undefined;
  try {
    return parseDetails(await fetchPlace(placeId, DETAIL_FIELDS, get), placeId, title);
  } catch (err) {
    console.error("place details failed", err instanceof Error ? err.message : err);
    return undefined;
  }
}

export interface PlaceHours {
  hours?: OpeningHours;
  mapsUrl?: string;
}

/** Live opening hours for a stop (one capped call). */
export async function lookupHours(title: string, city: string, get: Fetcher = fetch): Promise<PlaceHours> {
  const placeId = await placeIdFor(title, city, get);
  if (!placeId) return {};
  const mapsUrl = mapsUrlFor(placeId, title);
  if (!(await takeMonthlyQuota("google-places", detailsCap()))) return { mapsUrl };
  try {
    return { hours: parseGoogleHours(await fetchPlace(placeId, HOURS_FIELDS, get)), mapsUrl };
  } catch (err) {
    console.error("hours lookup failed", err instanceof Error ? err.message : err);
    return { mapsUrl };
  }
}

export interface PlacePhoto {
  /** A short-lived Google image URL; used directly by the browser, never stored. */
  src: string;
  author?: string;
  authorUrl?: string;
}

interface RawPhoto {
  name?: unknown;
  authorAttributions?: { displayName?: unknown; uri?: unknown }[];
}

/**
 * Up to `count` photos of a stop. The photo list comes from the free "IDs only" details SKU; each
 * image costs one capped Place Photo call, so a card asks for 1 and the details panel for a few.
 */
export async function placePhotos(title: string, city: string, count: number, maxWidth: number, get: Fetcher = fetch): Promise<PlacePhoto[]> {
  const placeId = await placeIdFor(title, city, get);
  if (!placeId) return [];
  let photos: RawPhoto[];
  try {
    photos = (((await fetchPlace(placeId, "id,photos", get)) as { photos?: RawPhoto[] }).photos ?? []).slice(0, Math.max(0, Math.min(6, count)));
  } catch (err) {
    console.error("place photos failed", err instanceof Error ? err.message : err);
    return [];
  }
  const out: PlacePhoto[] = [];
  for (const p of photos) {
    if (typeof p.name !== "string" || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(p.name)) continue;
    if (!(await takeMonthlyQuota("google-photos", photosCap()))) break;
    try {
      const url = `${API}/${p.name}/media?maxWidthPx=${Math.max(100, Math.min(1600, Math.round(maxWidth)))}&skipHttpRedirect=true`;
      const res = await get(url, { method: "GET", headers: headers(), signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`place photo ${res.status}`);
      const src = ((await res.json()) as { photoUri?: unknown }).photoUri;
      if (typeof src !== "string" || !src.startsWith("https://")) continue;
      const a = p.authorAttributions?.[0];
      out.push({
        src,
        author: typeof a?.displayName === "string" ? a.displayName.slice(0, 80) : undefined,
        authorUrl: typeof a?.uri === "string" && a.uri.startsWith("https://") ? a.uri : undefined,
      });
    } catch (err) {
      console.error("place photo failed", err instanceof Error ? err.message : err);
    }
  }
  return out;
}
