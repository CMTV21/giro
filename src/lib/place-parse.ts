import { distanceKm } from "./airports.ts";
import { normalizeCity } from "./destinations.ts";

/** Parsing and matching for place lookups (Wikipedia, Nominatim). Pure, so it's testable offline. */

export interface PlaceInfo {
  title?: string;
  description?: string;
  extract?: string;
  url?: string;
  thumbnail?: string;
  lat?: number;
  lon?: number;
  facts?: string[];
  /** Credit for `thumbnail` (a Wikimedia Commons file, so freely licensed). */
  photo?: PhotoCredit;
  source: "wikipedia" | "nominatim" | "none";
}

export interface PhotoCredit {
  /** Commons file page, where the full licence terms live. */
  page: string;
  author?: string;
  license?: string;
}

const STOP = new Set(["the", "and", "of", "a", "an", "at", "in", "on", "to", "de", "la", "le", "da", "do", "tour", "walk", "stroll", "visit", "day", "trip", "evening", "night", "sunset", "sunrise", "class", "lesson", "crawl", "hop", "market", "museum", "park", "gardens", "garden", "climb", "ride", "cruise", "show", "dinner", "lunch", "breakfast", "tasting", "food", "street", "old", "town", "historic", "with", "your", "free", "time", "around"]);

export const placeKey = (title: string, city: string) => `${normalizeCity(title)}|${normalizeCity(city)}`;

const tokens = (s: string) => normalizeCity(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w));

/**
 * Choose the Wikipedia result that is really this place. Requires most of the activity's
 * distinctive words to appear in the article title (e.g. "Belém Tower" for "Belém monuments"
 * is accepted on "belem"; "Montserrat (island)" is rejected later by distance).
 */
export function pickWikiTitle(activityTitle: string, city: string, results: { title: string; snippet?: string }[]): string | undefined {
  const want = tokens(activityTitle).filter((w) => !tokens(city).includes(w) || tokens(activityTitle).length === 1);
  if (!want.length) return undefined;
  let best: { title: string; score: number } | undefined;
  results.slice(0, 5).forEach((r, rank) => {
    if (/\(disambiguation\)|^list of /i.test(r.title)) return;
    const have = new Set(tokens(r.title));
    const hits = want.filter((w) => have.has(w) || [...have].some((h) => h.startsWith(w) || w.startsWith(h))).length;
    const score = hits / want.length;
    // Accept strong matches anywhere, or the search engine's top pick if it shares a distinctive word.
    if ((score >= 0.5 || (rank === 0 && hits >= 1)) && (!best || score > best.score)) best = { title: r.title, score };
  });
  return best?.title;
}

export function parseSearch(json: unknown): { title: string; snippet?: string }[] {
  const s = (json as { query?: { search?: { title?: unknown; snippet?: unknown }[] } })?.query?.search;
  return Array.isArray(s) ? s.filter((r) => typeof r.title === "string").map((r) => ({ title: r.title as string, snippet: typeof r.snippet === "string" ? r.snippet : undefined })) : [];
}

export function parseSummary(json: unknown): PlaceInfo | undefined {
  const j = json as { type?: string; title?: string; description?: string; extract?: string; coordinates?: { lat?: number; lon?: number }; thumbnail?: { source?: string }; content_urls?: { desktop?: { page?: string } } };
  if (!j || typeof j !== "object" || j.type === "disambiguation" || typeof j.extract !== "string" || !j.extract.trim()) return undefined;
  const url = j.content_urls?.desktop?.page;
  const thumb = j.thumbnail?.source;
  return {
    title: j.title,
    description: typeof j.description === "string" ? j.description : undefined,
    extract: j.extract.trim().slice(0, 1200),
    url: typeof url === "string" && url.startsWith("https://") ? url : undefined,
    // Commons files are freely licensed; English-Wikipedia uploads can be non-free (fair use), so skip those.
    thumbnail: typeof thumb === "string" && thumb.startsWith("https://upload.wikimedia.org/wikipedia/commons/") ? thumb : undefined,
    lat: typeof j.coordinates?.lat === "number" ? j.coordinates.lat : undefined,
    lon: typeof j.coordinates?.lon === "number" ? j.coordinates.lon : undefined,
    source: "wikipedia",
  };
}

export function parseNominatim(json: unknown): { lat: number; lon: number; name?: string } | undefined {
  const hit = Array.isArray(json) ? (json[0] as { lat?: string; lon?: string; display_name?: string }) : undefined;
  const lat = Number(hit?.lat);
  const lon = Number(hit?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, name: hit?.display_name } : undefined;
}

/** Reject coordinates implausibly far from the city (wrong-place matches). Day trips get more room. */
export function nearCity(point: { lat?: number; lon?: number }, city: { lat: number; lon: number } | undefined, dayTrip: boolean): boolean {
  if (point.lat === undefined || point.lon === undefined) return true;
  if (!city || !Number.isFinite(city.lat)) return true;
  return distanceKm(city, { lat: point.lat, lon: point.lon }) <= (dayTrip ? 200 : 60);
}

/** "File:Name.jpg" for a Commons image or thumbnail URL. */
export function commonsFile(url: string): string | undefined {
  const m = url.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/);
  if (!m) return undefined;
  try {
    return `File:${decodeURIComponent(m[1])}`;
  } catch {
    return undefined;
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
const plain = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/\s+/g, " ")
    .trim();

/** Author and licence from a Commons imageinfo/extmetadata response. */
export function parseCommonsCredit(json: unknown, file: string): PhotoCredit {
  const page = `https://commons.wikimedia.org/wiki/${encodeURIComponent(file.replaceAll(" ", "_")).replace(/%3A/i, ":")}`;
  const meta = (json as { query?: { pages?: { imageinfo?: { extmetadata?: Record<string, { value?: unknown }> }[] }[] } })?.query?.pages?.[0]?.imageinfo?.[0]?.extmetadata;
  const text = (k: string) => {
    const v = meta?.[k]?.value;
    const t = typeof v === "string" ? plain(v) : "";
    return t ? t.slice(0, 120) : undefined;
  };
  return { page, author: text("Artist"), license: text("LicenseShortName") };
}
