import "server-only";
import { summarizeFares, type FareSummary } from "../lib/fares.ts";
import { getDb } from "./db.ts";

/**
 * Fares seen recently on a route (Travelpayouts Aviasales data API, prices_for_dates). One request
 * per route, month and currency every 6 hours. Off unless TRAVELPAYOUTS_TOKEN is set.
 */

export const faresEnabled = () => Boolean(process.env.TRAVELPAYOUTS_TOKEN?.trim());

const ENDPOINT = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
const FRESH_HOURS = 6;

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

const monthOf = (d: string) => d.slice(0, 7);

async function fetchMonth(from: string, to: string, depart: string, ret: string, currency: string, get: Fetcher): Promise<unknown[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("origin", from);
  url.searchParams.set("destination", to);
  url.searchParams.set("departure_at", monthOf(depart));
  url.searchParams.set("return_at", monthOf(ret));
  url.searchParams.set("currency", currency.toLowerCase());
  url.searchParams.set("sorting", "price");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("one_way", "false");
  const res = await get(url.toString(), { headers: { "x-access-token": process.env.TRAVELPAYOUTS_TOKEN!.trim(), "accept-encoding": "gzip" }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`fares ${res.status}`);
  const json = (await res.json()) as { success?: boolean; data?: unknown[] };
  return json.success === false ? [] : json.data ?? [];
}

export async function findFares(from: string, to: string, depart: string, ret: string, currency: string, get: Fetcher = fetch): Promise<FareSummary | undefined> {
  const db = await getDb();
  const key = `${from}|${to}|${monthOf(depart)}|${monthOf(ret)}|${currency}`;
  const [row] = await db.query<{ data: unknown; age_hours: number }>("select data, extract(epoch from now() - fetched_at) / 3600 as age_hours from fare_cache where key = $1", [key]);
  const cachedRows = row?.data ? ((typeof row.data === "string" ? JSON.parse(row.data) : row.data) as unknown[]) : undefined;
  let rows = row && Number(row.age_hours) < FRESH_HOURS ? cachedRows : undefined;
  if (!rows && faresEnabled()) {
    try {
      rows = await fetchMonth(from, to, depart, ret, currency, get);
      await db.query("insert into fare_cache (key, data) values ($1, $2::jsonb) on conflict (key) do update set data = excluded.data, fetched_at = now()", [key, JSON.stringify(rows.slice(0, 1000))]);
    } catch (err) {
      console.error("fare lookup failed", err instanceof Error ? err.message : err);
      rows = cachedRows;
    }
  }
  return rows ? summarizeFares(rows, depart, ret, currency) : undefined;
}
