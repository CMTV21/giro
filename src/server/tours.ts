import "server-only";
import { normalizeCity } from "../lib/destinations.ts";
import { matchesStop, parseViatorProduct, type TourOffer } from "../lib/tours.ts";
import { getDb } from "./db.ts";

/**
 * Bookable tours for a stop from the Viator Partner API (affiliate access). One search per stop,
 * city and currency a week. Off unless VIATOR_API_KEY is set.
 */

export const toursEnabled = () => Boolean(process.env.VIATOR_API_KEY?.trim());

const ENDPOINT = "https://api.viator.com/partner/search/freetext";
const FRESH_DAYS = 7;

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

async function searchViator(title: string, city: string, currency: string, get: Fetcher): Promise<TourOffer | undefined> {
  const res = await get(ENDPOINT, {
    method: "POST",
    headers: {
      "exp-api-key": process.env.VIATOR_API_KEY!.trim(),
      "accept-language": "en-US",
      accept: "application/json;version=2.0",
      "content-type": "application/json",
    },
    body: JSON.stringify({ searchTerm: `${title} ${city}`, searchTypes: [{ searchType: "PRODUCTS", pagination: { start: 1, count: 5 } }], currency }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`viator ${res.status}`);
  const json = (await res.json()) as { products?: { results?: unknown[] } };
  for (const raw of json.products?.results ?? []) {
    const offer = parseViatorProduct(raw, currency);
    if (offer && matchesStop(title, offer.title)) return offer;
  }
  return undefined;
}

export async function findTour(title: string, city: string, currency: string, get: Fetcher = fetch): Promise<TourOffer | undefined> {
  const db = await getDb();
  const key = `viator|${normalizeCity(title)}|${normalizeCity(city)}|${currency}`.slice(0, 240);
  const [row] = await db.query<{ data: unknown; age_days: number }>("select data, extract(epoch from now() - fetched_at) / 86400 as age_days from tour_cache where key = $1", [key]);
  const cached = row?.data ? ((typeof row.data === "string" ? JSON.parse(row.data) : row.data) as TourOffer) : undefined;
  if (row && Number(row.age_days) < FRESH_DAYS) return cached;
  if (!toursEnabled()) return cached;
  try {
    const offer = await searchViator(title, city, currency, get);
    await db.query("insert into tour_cache (key, data) values ($1, $2::jsonb) on conflict (key) do update set data = excluded.data, fetched_at = now()", [key, offer ? JSON.stringify(offer) : null]);
    return offer;
  } catch (err) {
    console.error("tour search failed", err instanceof Error ? err.message : err);
    return cached;
  }
}
