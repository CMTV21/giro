import "server-only";
import { getDb } from "./db.ts";

/**
 * Travel times between stops from Stadia Maps routing (Valhalla). Walking when it's a reasonable
 * walk; otherwise a driving time plus a buffer stands in for taxi or transit. Cached per pair.
 * Off unless STADIA_API_KEY is set.
 */

export const routingEnabled = () => Boolean(process.env.STADIA_API_KEY?.trim());

export interface Point {
  lat: number;
  lon: number;
}

export interface Leg {
  minutes: number;
  km: number;
  mode: "walk" | "ride";
}

/** Longest walk Giro plans before suggesting a ride. */
export const MAX_WALK_MINUTES = 30;
/** Waiting, stops and parking on top of driving time when riding. */
export const RIDE_BUFFER_MINUTES = 10;

const ENDPOINT = "https://api.stadiamaps.com/route/v1";
const round = (n: number) => n.toFixed(4); // ~11 m
const pairKey = (a: Point, b: Point, costing: string) => `${costing}:${round(a.lat)},${round(a.lon)}>${round(b.lat)},${round(b.lon)}`;

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

async function valhalla(points: Point[], costing: "pedestrian" | "auto", get: Fetcher): Promise<{ minutes: number; km: number }[]> {
  const url = `${ENDPOINT}?api_key=${encodeURIComponent(process.env.STADIA_API_KEY!.trim())}`;
  const res = await get(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ locations: points.map((p) => ({ lat: p.lat, lon: p.lon })), costing, units: "kilometers", directions_type: "none" }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`routing ${res.status}`);
  const legs = ((await res.json()) as { trip?: { legs?: { summary?: { time?: number; length?: number } }[] } }).trip?.legs ?? [];
  if (legs.length !== points.length - 1) throw new Error("routing: leg count mismatch");
  return legs.map((l) => ({ minutes: Math.max(1, Math.round((l.summary?.time ?? 0) / 60)), km: Math.round((l.summary?.length ?? 0) * 100) / 100 }));
}

const valid = (p: Point) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/** Legs between consecutive points. Cached pairs are reused; the rest go in one walking request. */
export async function routeLegs(points: Point[], get: Fetcher = fetch): Promise<(Leg | undefined)[]> {
  if (points.length < 2 || !points.every(valid)) return [];
  const db = await getDb();
  const pairs = points.slice(1).map((b, i) => [points[i], b] as const);
  const cached = async (key: string) => (await db.query<{ minutes: number; km: number }>("select minutes, km from route_cache where key = $1 and fetched_at > now() - interval '90 days'", [key]))[0];
  const save = (key: string, v: { minutes: number; km: number }) =>
    db.query("insert into route_cache (key, minutes, km) values ($1, $2, $3) on conflict (key) do update set minutes = excluded.minutes, km = excluded.km, fetched_at = now()", [key, v.minutes, v.km]);

  const walk: ({ minutes: number; km: number } | undefined)[] = await Promise.all(pairs.map(([a, b]) => cached(pairKey(a, b, "pedestrian"))));
  if (walk.some((w) => !w) && routingEnabled()) {
    try {
      const fresh = await valhalla(points, "pedestrian", get);
      for (const [i, v] of fresh.entries()) {
        walk[i] = v;
        await save(pairKey(pairs[i][0], pairs[i][1], "pedestrian"), v);
      }
    } catch (err) {
      console.error("routing failed", err instanceof Error ? err.message : err);
    }
  }
  return Promise.all(
    pairs.map(async ([a, b], i) => {
      const w = walk[i];
      if (!w) return undefined;
      if (w.minutes <= MAX_WALK_MINUTES) return { ...w, mode: "walk" as const };
      const key = pairKey(a, b, "auto");
      let drive = await cached(key);
      if (!drive && routingEnabled()) {
        try {
          [drive] = await valhalla([a, b], "auto", get);
          await save(key, drive);
        } catch {
          /* fall back to the walking figure below */
        }
      }
      return drive ? { minutes: drive.minutes + RIDE_BUFFER_MINUTES, km: drive.km, mode: "ride" as const } : { ...w, mode: "walk" as const };
    }),
  );
}
