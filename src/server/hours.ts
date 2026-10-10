import "server-only";
import { normalizeCity } from "../lib/destinations.ts";
import { parseGoogleHours, type OpeningHours } from "../lib/hours.ts";
import { getDb } from "./db.ts";

/**
 * Opening hours from Google Places (New) Text Search. Each place is looked up at most once a
 * month (a miss is retried after a week), so cost stays low. Off unless GOOGLE_PLACES_API_KEY is set.
 */

export const hoursEnabled = () => Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());

const FRESH_DAYS = 30;
const MISS_DAYS = 7;
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELDS = "places.id,places.displayName,places.businessStatus,places.regularOpeningHours,places.googleMapsUri";

export const hoursKey = (title: string, city: string) => `${normalizeCity(title)}|${normalizeCity(city)}`.slice(0, 240);

export interface PlaceHours {
  hours?: OpeningHours;
  mapsUrl?: string;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

async function fetchGoogle(title: string, city: string, get: Fetcher): Promise<PlaceHours> {
  const res = await get(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GOOGLE_PLACES_API_KEY!.trim(), "x-goog-fieldmask": FIELDS },
    body: JSON.stringify({ textQuery: `${title}, ${city}`, pageSize: 1, languageCode: "en" }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`places ${res.status}`);
  const place = ((await res.json()) as { places?: { googleMapsUri?: string }[] }).places?.[0];
  const url = place?.googleMapsUri;
  return { hours: parseGoogleHours(place), mapsUrl: url && /^https:\/\/(maps\.google\.com|www\.google\.com\/maps|maps\.app\.goo\.gl)\//.test(url) ? url : undefined };
}

export async function lookupHours(title: string, city: string, get: Fetcher = fetch): Promise<PlaceHours> {
  const db = await getDb();
  const key = hoursKey(title, city);
  const [row] = await db.query<{ hours: unknown; maps_url: string | null; age_days: number }>(
    "select hours, maps_url, extract(epoch from now() - fetched_at) / 86400 as age_days from place_hours where key = $1",
    [key],
  );
  const cachedHours = row?.hours ? ((typeof row.hours === "string" ? JSON.parse(row.hours) : row.hours) as OpeningHours) : undefined;
  if (row && Number(row.age_days) < (cachedHours ? FRESH_DAYS : MISS_DAYS)) return { hours: cachedHours, mapsUrl: row.maps_url ?? undefined };
  if (!hoursEnabled()) return { hours: cachedHours };
  try {
    const found = await fetchGoogle(title, city, get);
    await db.query(
      `insert into place_hours (key, hours, maps_url) values ($1, $2::jsonb, $3)
       on conflict (key) do update set hours = excluded.hours, maps_url = excluded.maps_url, fetched_at = now()`,
      [key, found.hours ? JSON.stringify(found.hours) : null, found.mapsUrl ?? null],
    );
    return found;
  } catch (err) {
    console.error("hours lookup failed", err instanceof Error ? err.message : err);
    return { hours: cachedHours, mapsUrl: row?.maps_url ?? undefined };
  }
}
