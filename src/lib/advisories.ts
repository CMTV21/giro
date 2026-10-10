/**
 * Government of Canada travel advice (travel.gc.ca), from its open-data feed. Levels use the
 * official wording. Parsing is defensive: anything unexpected is dropped rather than guessed at.
 */

export type AdvisoryLevel = 0 | 1 | 2 | 3;

export interface Advisory {
  iso: string;
  country: string;
  level: AdvisoryLevel;
  /** Some regions carry a higher level than the country as a whole. */
  regional: boolean;
  /** Date the advice was last published (YYYY-MM-DD), when given. */
  updated?: string;
  url: string;
}

export const ADVISORY_FEED = "https://data.international.gc.ca/travel-voyage/index-updated.json";
export const ADVISORY_SOURCE = "Government of Canada";

export const LEVELS: Record<AdvisoryLevel, { label: string; tone: string }> = {
  0: { label: "Take normal security precautions", tone: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  1: { label: "Exercise a high degree of caution", tone: "bg-amber-50 text-amber-900 border-amber-200" },
  2: { label: "Avoid non-essential travel", tone: "bg-orange-50 text-orange-950 border-orange-300" },
  3: { label: "Avoid all travel", tone: "bg-red-50 text-red-900 border-red-300" },
};

/** ISO codes for the catalog's countries. Canada is home, so it has no advisory. */
export const COUNTRY_ISO: Record<string, string> = {
  France: "FR", Japan: "JP", Portugal: "PT", Italy: "IT", Spain: "ES", "United Kingdom": "GB", "United States": "US", Mexico: "MX",
  Indonesia: "ID", Thailand: "TH", Morocco: "MA", Iceland: "IS", "South Africa": "ZA", Netherlands: "NL", Ireland: "IE",
  Czechia: "CZ", Greece: "GR", Türkiye: "TR", "South Korea": "KR", Singapore: "SG", Australia: "AU", Canada: "CA",
};

export const HOME_ISO = "CA";

const toLevel = (v: unknown): AdvisoryLevel | undefined => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return n === 0 || n === 1 || n === 2 || n === 3 ? n : undefined;
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);

/** One country's entry from the feed, or undefined if it doesn't look right. */
export function parseEntry(iso: string, raw: unknown): Advisory | undefined {
  if (!/^[A-Z]{2}$/.test(iso) || !isObj(raw)) return undefined;
  const level = toLevel(raw["advisory-state"]);
  if (level === undefined) return undefined;
  const eng = isObj(raw.eng) ? raw.eng : {};
  const country = str(eng.name) ?? str(raw["country-eng"]) ?? iso;
  const slug = str(eng["url-slug"]);
  const published = isObj(raw["date-published"]) ? str(raw["date-published"].date) : str(raw["date-published"]);
  const updated = published && /^\d{4}-\d{2}-\d{2}/.test(published) ? published.slice(0, 10) : undefined;
  return {
    iso,
    country,
    level,
    regional: Number(raw["has-regional-advisory"]) === 1,
    updated,
    url: slug && /^[a-z0-9-]+$/.test(slug) ? `https://travel.gc.ca/destinations/${slug}` : "https://travel.gc.ca/travelling/advisories",
  };
}

/** The whole feed: `{ data: { "PT": {...}, ... } }`. */
export function parseAdvisories(json: unknown): Map<string, Advisory> {
  const out = new Map<string, Advisory>();
  const data = isObj(json) && isObj(json.data) ? json.data : undefined;
  if (!data) return out;
  for (const [iso, raw] of Object.entries(data)) {
    const a = parseEntry(iso.toUpperCase(), raw);
    if (a) out.set(a.iso, a);
  }
  return out;
}

/** Countries whose advice got stricter since the traveller last saw it. */
export function raisedSince(seen: Record<string, number> | undefined, current: Advisory[]): Advisory[] {
  if (!seen) return [];
  return current.filter((a) => seen[a.iso] !== undefined && a.level > seen[a.iso]);
}

/** The levels to remember after showing these, or undefined when nothing changed. */
export function nextSeen(seen: Record<string, number> | undefined, current: Advisory[]): Record<string, number> | undefined {
  const next = { ...(seen ?? {}) };
  let changed = false;
  for (const a of current) {
    if (next[a.iso] !== a.level) {
      next[a.iso] = a.level;
      changed = true;
    }
  }
  return changed ? next : undefined;
}
