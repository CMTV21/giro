"use client";

import { useEffect, useRef } from "react";
import { placeInfo } from "./places-client";
import { estimateLeg } from "./getting-around";
import { chainsOf, hopsOf, routable, withTravel } from "./travel";
import type { Activity, TravelLeg, Trip } from "./types";

let enabledCheck: Promise<boolean> | undefined;
/** Asks once per page load whether routing is set up on the server. */
export const routingAvailable = () =>
  (enabledCheck ??= fetch("/api/route")
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((j: { enabled?: boolean }) => Boolean(j.enabled))
    .catch(() => false));

type Located = { lat: number; lon: number; coarse?: boolean };

async function pointOf(a: Activity, city: string): Promise<Located | undefined> {
  if (a.place) return a.place;
  const info = await placeInfo({ title: a.category === "free" && a.area ? `${a.area}` : a.title, durationHrs: a.durationHrs }, city).catch(() => undefined);
  if (info?.lat !== undefined && info?.lon !== undefined) return { lat: info.lat, lon: info.lon };
  // Catalog names ("Eiffel Tower summit") often don't match a map entry; the neighbourhood is close enough.
  if (!a.area || a.category === "free") return undefined;
  const area = await placeInfo({ title: a.area, durationHrs: a.durationHrs }, city).catch(() => undefined);
  return area?.lat !== undefined && area?.lon !== undefined ? { lat: area.lat, lon: area.lon, coarse: true } : undefined;
}

/**
 * Measure travel between consecutive stops (walking, or a ride for long hops) and save it on the
 * trip, so times everywhere use real distances. With routing configured the legs are measured;
 * without it they're estimated from straight-line distance. Runs for editors a couple of seconds
 * after the plan's order settles.
 */
export function useTravelTimes(trip: Trip, editable: boolean, commit: (next: Trip) => void) {
  const latest = useRef(trip);
  latest.current = trip;
  const signature = trip.days.map((d) => `${d.city}:${d.activities.map((a) => a.id).join(",")}`).join("|");

  useEffect(() => {
    if (!editable) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const routing = await routingAvailable();
      if (cancelled) return;
      const measured = new Map<string, TravelLeg>();
      for (const day of latest.current.days) {
        const hops = hopsOf(latest.current, day).filter((h) => routable(h.from) && routable(h.to));
        if (!hops.length) continue;
        // Route the day as chains of consecutive located stops.
        const stops = [...new Map(hops.flatMap((h) => [h.from, h.to]).map((a) => [a.id, a])).values()];
        const points = new Map<string, Located>();
        await Promise.all(stops.map(async (a) => {
          const p = await pointOf(a, day.city);
          if (p) points.set(a.id, p);
        }));
        // Two neighbourhood-level points in the same area say nothing about the distance between them.
        const located = hops.filter((h) => points.has(h.from.id) && points.has(h.to.id) && !(points.get(h.from.id)!.coarse && points.get(h.to.id)!.coarse && h.from.area === h.to.area));
        if (!located.length || cancelled) continue;
        if (!routing) {
          // Keep a measured leg; otherwise estimate from the two points.
          for (const h of located) {
            if (h.to.travel?.from === h.from.id && !h.to.travel.est) continue;
            measured.set(h.to.id, { from: h.from.id, ...estimateLeg(points.get(h.from.id)!, points.get(h.to.id)!), est: true });
          }
          continue;
        }
        for (const chain of chainsOf(located)) {
          const res = await fetch("/api/route", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ points: [chain[0].from, ...chain.map((h) => h.to)].map((a) => ({ lat: points.get(a.id)!.lat, lon: points.get(a.id)!.lon })) }),
          }).catch(() => undefined);
          if (!res?.ok) continue;
          const { legs } = (await res.json()) as { legs: ({ minutes: number; km?: number; mode: "walk" | "ride" } | null)[] };
          chain.forEach((h, i) => {
            const leg = legs[i];
            if (leg) measured.set(h.to.id, { from: h.from.id, mins: leg.minutes, mode: leg.mode, ...(leg.km !== undefined ? { km: leg.km } : {}) });
          });
        }
      }
      if (cancelled || !measured.size) return;
      const next = withTravel(latest.current, measured);
      if (next !== latest.current) commit(next);
    }, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [signature, editable]); // eslint-disable-line react-hooks/exhaustive-deps
}
