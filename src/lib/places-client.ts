"use client";

import type { PlaceInfo } from "./place-parse";
import type { Activity } from "./types";

const cache = new Map<string, Promise<PlaceInfo>>();
let active = 0;
const queue: (() => void)[] = [];

// A few lookups at a time keeps us polite to the upstream APIs on a 30-stop trip.
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 4) await new Promise<void>((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

export interface PlaceQuery {
  /** Also generate "did you know" facts (a Claude call), for the history panel and the guide. */
  facts?: boolean;
  /** Restaurants: only trust articles located in the city, since names are often shared. */
  strict?: boolean;
}

export function placeInfo(a: Pick<Activity, "title" | "durationHrs">, city: string, q: PlaceQuery = {}): Promise<PlaceInfo> {
  const base = `${a.title}|${city}|${q.strict ? "s" : ""}`;
  // A request with facts also answers later photo-only requests for the same place.
  const hit = cache.get(`${base}|f`) ?? (q.facts ? undefined : cache.get(base));
  if (hit) return hit;
  const p = new URLSearchParams({ title: a.title, city });
  if (a.durationHrs >= 6) p.set("daytrip", "1");
  if (q.facts) p.set("facts", "1");
  if (q.strict) p.set("strict", "1");
  const promise = slot(() =>
    fetch(`/api/places?${p.toString()}`)
      .then((r) => (r.ok ? (r.json() as Promise<PlaceInfo>) : { source: "none" as const }))
      .catch(() => ({ source: "none" as const })),
  );
  cache.set(q.facts ? `${base}|f` : base, promise);
  return promise;
}
