import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { AI_MODEL, aiAvailable } from "../lib/ai.ts";
import { findDestination } from "../lib/destinations.ts";
import { nearCity, parseNominatim, parseSearch, parseSummary, pickWikiTitle, placeKey, type PlaceInfo } from "../lib/place-parse.ts";
import { getDb } from "./db.ts";
import { appUrl } from "./email.ts";

/**
 * History, facts and coordinates for a sight. Wikipedia text (CC BY-SA, attributed in the UI)
 * with Nominatim (OpenStreetMap) as a coordinate fallback. Results, including misses, are cached
 * so each place is fetched at most once a month.
 */

const HIT_DAYS = 30;
const MISS_DAYS = 7;
const UA = () => `GiroTripPlanner/1.0 (${appUrl()}${process.env.CONTACT_EMAIL ? `; ${process.env.CONTACT_EMAIL}` : ""})`;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "user-agent": UA(), accept: "application/json" }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

export type Fetcher = (url: string) => Promise<unknown>;

export async function fetchPlace(title: string, city: string, dayTrip: boolean, get: Fetcher = getJson): Promise<PlaceInfo> {
  const center = findDestination(city);
  const cityPoint = center && Number.isFinite(center.lat) ? center : undefined;
  let info: PlaceInfo = { source: "none" };
  try {
    const search = parseSearch(await get(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=${encodeURIComponent(`${title} ${city}`)}`));
    const pick = pickWikiTitle(title, city, search);
    if (pick) {
      const summary = parseSummary(await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pick.replaceAll(" ", "_"))}`));
      if (summary && nearCity(summary, cityPoint, dayTrip)) info = summary;
    }
  } catch {
    /* fall through to geocoding */
  }
  if (info.lat === undefined) {
    try {
      const hit = parseNominatim(await get(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(`${title}, ${city}`)}`));
      if (hit && nearCity(hit, cityPoint, dayTrip)) info = { ...info, lat: hit.lat, lon: hit.lon, source: info.source === "none" ? "nominatim" : info.source };
    } catch {
      /* no coordinates */
    }
  }
  return info;
}

/** Three short facts drawn only from the Wikipedia extract, so nothing is invented. */
export async function factsFromExtract(title: string, extract: string, client = new Anthropic()): Promise<string[]> {
  const message = await client.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 1500,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(z.object({ facts: z.array(z.string()) })) },
    messages: [
      {
        role: "user",
        content: `From the text below about ${title}, write up to three short "did you know" facts for a traveller, each one sentence. Use only information stated in the text; if it has fewer interesting facts, return fewer.\n\n<text>\n${extract}\n</text>`,
      },
    ],
  });
  if (message.stop_reason === "refusal") return [];
  return (message.parsed_output?.facts ?? []).map((f) => f.trim()).filter((f) => f.length > 10 && f.length < 300).slice(0, 3);
}

interface Row {
  title: string | null;
  description: string | null;
  extract: string | null;
  url: string | null;
  thumbnail: string | null;
  lat: number | null;
  lon: number | null;
  facts: unknown;
  source: PlaceInfo["source"];
}

const fromRow = (r: Row): PlaceInfo => ({
  title: r.title ?? undefined,
  description: r.description ?? undefined,
  extract: r.extract ?? undefined,
  url: r.url ?? undefined,
  thumbnail: r.thumbnail ?? undefined,
  lat: r.lat ?? undefined,
  lon: r.lon ?? undefined,
  facts: (typeof r.facts === "string" ? JSON.parse(r.facts) : r.facts) ?? undefined,
  source: r.source,
});

export async function lookupPlace(title: string, city: string, dayTrip = false, get?: Fetcher): Promise<PlaceInfo> {
  const key = placeKey(title, city);
  const db = await getDb();
  const [cached] = await db.query<Row>(
    `select title, description, extract, url, thumbnail, lat, lon, facts, source from place_info
      where key = $1 and fetched_at > now() - (case when source = 'none' then $2 else $3 end || ' days')::interval`,
    [key, String(MISS_DAYS), String(HIT_DAYS)],
  );
  if (cached) return fromRow(cached);

  const info = await fetchPlace(title, city, dayTrip, get);
  if (info.extract && aiAvailable()) info.facts = await factsFromExtract(info.title ?? title, info.extract).catch(() => undefined);
  await db.query(
    `insert into place_info (key, title, description, extract, url, thumbnail, lat, lon, facts, source, fetched_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, now())
     on conflict (key) do update set title = excluded.title, description = excluded.description, extract = excluded.extract, url = excluded.url,
       thumbnail = excluded.thumbnail, lat = excluded.lat, lon = excluded.lon, facts = excluded.facts, source = excluded.source, fetched_at = now()`,
    [key, info.title ?? null, info.description ?? null, info.extract ?? null, info.url ?? null, info.thumbnail ?? null, info.lat ?? null, info.lon ?? null, JSON.stringify(info.facts ?? null), info.source],
  );
  return info;
}

/** Geocode a street address (e.g. your hotel) near a city. Cached like place lookups. */
export async function geocodeAddress(address: string, city: string, get: Fetcher = getJson): Promise<{ lat: number; lon: number } | undefined> {
  const key = `addr:${placeKey(address, city)}`;
  const db = await getDb();
  const [cached] = await db.query<Row>("select lat, lon, source from place_info where key = $1 and fetched_at > now() - interval '90 days'", [key]);
  if (cached) return cached.lat !== null && cached.lon !== null ? { lat: cached.lat, lon: cached.lon } : undefined;
  const center = findDestination(city);
  let hit: { lat: number; lon: number } | undefined;
  try {
    const q = address.toLowerCase().includes(city.toLowerCase()) ? address : `${address}, ${city}`;
    const found = parseNominatim(await get(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`));
    if (found && nearCity(found, center && Number.isFinite(center.lat) ? center : undefined, false)) hit = { lat: found.lat, lon: found.lon };
  } catch {
    /* not found */
  }
  await db.query(
    "insert into place_info (key, lat, lon, source, fetched_at) values ($1, $2, $3, $4, now()) on conflict (key) do update set lat = excluded.lat, lon = excluded.lon, source = excluded.source, fetched_at = now()",
    [key, hit?.lat ?? null, hit?.lon ?? null, hit ? "nominatim" : "none"],
  );
  return hit;
}
