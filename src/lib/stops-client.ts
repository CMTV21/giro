"use client";

import type { PlaceInfo } from "./place-parse";
import { placeInfo } from "./places-client";
import type { ScheduledItem } from "./schedule";
import type { Day, Stay, Trip } from "./types";

export interface MapStop {
  n: number;
  title: string;
  lat: number;
  lon: number;
}

export interface ResolvedStop {
  item: ScheduledItem;
  info: PlaceInfo;
}

const geocache = new Map<string, Promise<{ lat?: number; lon?: number }>>();

export function stayFor(trip: Trip, day: Day): Stay | undefined {
  return trip.stays.find((s) => s.city === day.city && s.checkIn <= day.date && day.date <= s.checkOut);
}

/** Coordinates for the traveller's stay: saved on the booking, or geocoded from its address. */
export async function stayPoint(stay: Stay | undefined): Promise<{ lat: number; lon: number; name: string } | undefined> {
  const b = stay?.booking;
  if (!b) return undefined;
  if (b.lat !== undefined && b.lon !== undefined) return { lat: b.lat, lon: b.lon, name: b.name };
  if (!b.address) return undefined;
  const key = `${b.address}|${stay!.city}`;
  if (!geocache.has(key)) {
    geocache.set(key, fetch(`/api/geocode?${new URLSearchParams({ address: b.address, city: stay!.city })}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  }
  const hit = await geocache.get(key)!;
  return hit.lat !== undefined && hit.lon !== undefined ? { lat: hit.lat, lon: hit.lon, name: b.name } : undefined;
}

/** History and coordinates for each timed stop of a day, in schedule order. */
export async function resolveStops(day: Day, items: ScheduledItem[]): Promise<ResolvedStop[]> {
  const acts = items.filter((i) => i.kind === "activity" && i.activity && i.activity.category !== "transit" && i.activity.category !== "free");
  return Promise.all(
    acts.map(async (item) => {
      const a = item.activity!;
      const info = await placeInfo(a, day.city);
      return { item, info: a.place ? { ...info, lat: a.place.lat, lon: a.place.lon } : info };
    }),
  );
}

export const mapStops = (stops: ResolvedStop[]): MapStop[] =>
  stops.flatMap((s, i) => (s.info.lat !== undefined && s.info.lon !== undefined ? [{ n: i + 1, title: s.item.activity!.title, lat: s.info.lat, lon: s.info.lon }] : []));
