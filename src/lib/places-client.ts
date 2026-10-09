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

export function placeInfo(a: Pick<Activity, "title" | "durationHrs">, city: string): Promise<PlaceInfo> {
  const key = `${a.title}|${city}`;
  if (!cache.has(key)) {
    const p = new URLSearchParams({ title: a.title, city });
    if (a.durationHrs >= 6) p.set("daytrip", "1");
    cache.set(
      key,
      slot(() =>
        fetch(`/api/places?${p.toString()}`)
          .then((r) => (r.ok ? (r.json() as Promise<PlaceInfo>) : { source: "none" as const }))
          .catch(() => ({ source: "none" as const })),
      ),
    );
  }
  return cache.get(key)!;
}
