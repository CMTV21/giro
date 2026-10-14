import { normalizeCity } from "./destinations.ts";
import type { Activity } from "./types.ts";

/**
 * The best way to get from one stop to the next: walk when it's a reasonable walk, otherwise the
 * city's public transport where it's good, or a taxi/ride-hail where it isn't (and late at night).
 * Uses the measured leg when routing is on, else an estimate from straight-line distance.
 */

export type HopMode = "walk" | "transit" | "taxi";

export interface HopAdvice {
  mode: HopMode;
  mins: number;
  /** "~12 min walk", "~25 min by Métro", "~15 min by taxi". */
  label: string;
  /** A second option worth knowing ("or ~10 min by taxi"). */
  alt?: string;
  km?: number;
  /** From straight-line distance rather than a measured route. */
  estimated: boolean;
  directionsUrl: string;
}

interface CityTransit {
  /** What locals call it, used in labels. Absent: taxi/ride-hail is the better bet. */
  transit?: string;
  /** How to get a car there. */
  taxi: string;
}

const CITY_TRANSIT: Record<string, CityTransit> = {
  paris: { transit: "Métro", taxi: "taxi" },
  tokyo: { transit: "train", taxi: "taxi" },
  kyoto: { transit: "bus or subway", taxi: "taxi" },
  lisbon: { transit: "metro or tram", taxi: "Uber or Bolt" },
  rome: { transit: "metro or bus", taxi: "taxi" },
  barcelona: { transit: "Metro", taxi: "taxi" },
  london: { transit: "Tube", taxi: "black cab or Uber" },
  "new york": { transit: "subway", taxi: "taxi or Uber" },
  "mexico city": { transit: "Metro", taxi: "Uber or DiDi" },
  bali: { taxi: "Grab, Gojek or a hired driver" },
  bangkok: { transit: "BTS or MRT", taxi: "Grab" },
  marrakech: { taxi: "petit taxi" },
  reykjavik: { taxi: "taxi" },
  "cape town": { taxi: "Uber or Bolt" },
  amsterdam: { transit: "tram", taxi: "taxi or Uber" },
  dublin: { transit: "Luas or bus", taxi: "taxi (FreeNow)" },
  prague: { transit: "tram or metro", taxi: "Bolt or Uber" },
  florence: { taxi: "taxi" },
  athens: { transit: "Metro", taxi: "taxi (FreeNow)" },
  istanbul: { transit: "tram or metro", taxi: "taxi (BiTaksi)" },
  seoul: { transit: "subway", taxi: "taxi (Kakao T)" },
  singapore: { transit: "MRT", taxi: "Grab" },
  cancun: { taxi: "taxi" },
  vancouver: { transit: "SkyTrain or bus", taxi: "taxi or Uber" },
  montreal: { transit: "Métro", taxi: "taxi or Uber" },
  sydney: { transit: "train or ferry", taxi: "Uber or taxi" },
};

export const cityTransit = (city: string): CityTransit => CITY_TRANSIT[normalizeCity(city)] ?? { transit: "public transport", taxi: "taxi" };

/** Longest walk suggested before a ride. Matches the server's routing threshold. */
export const WALK_LIMIT_MINUTES = 30;
const WALK_KMH = 4.8;
const DETOUR = 1.3; // streets aren't straight lines
const TAXI_KMH = 22;
const TAXI_OVERHEAD = 8; // hailing, traffic lights, drop-off
const TRANSIT_KMH = 20;
const TRANSIT_FAR_KMH = 32; // longer hops ride regional or express lines
const TRANSIT_OVERHEAD = 14; // walking to the station, waiting, walking out

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A travel leg estimated from two points, in the shape saved on `Activity.travel`. */
export function estimateLeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): { mins: number; km: number; mode: "walk" | "ride" } {
  const km = Math.round(distanceKm(a, b) * DETOUR * 100) / 100;
  const walk = Math.max(5, Math.round((km / WALK_KMH) * 60)); // never less than finding the way out and in
  return walk <= WALK_LIMIT_MINUTES ? { mins: walk, km, mode: "walk" } : { mins: Math.round((km / TAXI_KMH) * 60 + TAXI_OVERHEAD), km, mode: "ride" };
}

const where = (a: Activity, city: string) => (a.place ? `${a.place.lat},${a.place.lon}` : `${a.category === "free" && a.area ? a.area : a.title}, ${city}`);

export function directionsUrl(from: Activity, to: Activity, city: string, mode: HopMode): string {
  const q = new URLSearchParams({ api: "1", origin: where(from, city), destination: where(to, city), travelmode: mode === "walk" ? "walking" : mode === "transit" ? "transit" : "driving" });
  return `https://www.google.com/maps/dir/?${q}`;
}

/** Late evening or before dawn, a car beats waiting for a night bus. */
const lateNight = (startMin?: number) => startMin !== undefined && (startMin >= 23 * 60 || startMin < 5 * 60 + 30);

/**
 * How to get from `from` to `to`. Without a measured or estimated leg, falls back to the
 * neighbourhood: same area is a short walk, otherwise a ride. `startMin` is when the
 * destination stop begins (minutes after midnight), used to avoid suggesting transit at night.
 */
export function hopAdvice(from: Activity, to: Activity, city: string, startMin?: number): HopAdvice {
  const t = cityTransit(city);
  const leg = to.travel && to.travel.from === from.id ? to.travel : undefined;
  const sameArea = Boolean(from.area && to.area && from.area === to.area);
  const estimated = !leg || Boolean(leg.est);
  const km = leg?.km;

  let walkMins: number | undefined;
  let taxiMins: number;
  if (leg?.mode === "walk") {
    walkMins = leg.mins;
    taxiMins = round5(km !== undefined ? (km / TAXI_KMH) * 60 + TAXI_OVERHEAD : leg.mins / 3 + TAXI_OVERHEAD);
  } else if (leg) {
    taxiMins = leg.mins;
  } else {
    if (sameArea) walkMins = 15;
    taxiMins = sameArea ? 10 : 25;
  }
  if (estimated && taxiMins > 15) taxiMins = round5(taxiMins);
  const transitMins = round5(km !== undefined ? (km / (km > 8 ? TRANSIT_FAR_KMH : TRANSIT_KMH)) * 60 + TRANSIT_OVERHEAD : taxiMins + 10);

  const approx = (n: number) => `~${n} min`;
  const taxiLabel = `${approx(taxiMins)} by ${t.taxi}`;
  const transitLabel = t.transit ? `${approx(transitMins)} by ${t.transit}` : undefined;

  let mode: HopMode;
  let mins: number;
  let label: string;
  let alt: string | undefined;
  if (walkMins !== undefined) {
    mode = "walk";
    mins = walkMins;
    label = `${approx(walkMins)} walk`;
    // A long-ish walk: mention the quicker option.
    if (walkMins >= 20) alt = transitLabel && !lateNight(startMin) && transitMins < walkMins ? `or ${transitLabel}` : taxiMins < walkMins ? `or ${taxiLabel}` : undefined;
  } else if (transitLabel && !lateNight(startMin)) {
    mode = "transit";
    mins = transitMins;
    label = transitLabel;
    if (taxiMins + 10 <= transitMins) alt = `or ${taxiLabel}`;
  } else {
    mode = "taxi";
    mins = taxiMins;
    label = taxiLabel;
  }
  return { mode, mins, label, alt, km, estimated, directionsUrl: directionsUrl(from, to, city, mode) };
}
