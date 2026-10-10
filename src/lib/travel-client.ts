"use client";

import { useEffect, useRef } from "react";
import { placeInfo } from "./places-client";
import { chainsOf, hopsOf, routable, withTravel } from "./travel";
import type { Activity, Trip } from "./types";

let enabledCheck: Promise<boolean> | undefined;
/** Asks once per page load whether routing is set up on the server. */
export const routingAvailable = () =>
  (enabledCheck ??= fetch("/api/route")
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((j: { enabled?: boolean }) => Boolean(j.enabled))
    .catch(() => false));

async function pointOf(a: Activity, city: string): Promise<{ lat: number; lon: number } | undefined> {
  if (a.place) return a.place;
  const info = await placeInfo({ title: a.category === "free" && a.area ? `${a.area}` : a.title, durationHrs: a.durationHrs }, city).catch(() => undefined);
  return info?.lat !== undefined && info?.lon !== undefined ? { lat: info.lat, lon: info.lon } : undefined;
}

/**
 * Measure travel between consecutive stops (walking, or a ride for long hops) and save it on the
 * trip, so times everywhere use real distances. Runs for editors when routing is configured,
 * a couple of seconds after the plan's order settles.
 */
export function useTravelTimes(trip: Trip, editable: boolean, commit: (next: Trip) => void) {
  const latest = useRef(trip);
  latest.current = trip;
  const signature = trip.days.map((d) => `${d.city}:${d.activities.map((a) => a.id).join(",")}`).join("|");

  useEffect(() => {
    if (!editable) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!(await routingAvailable()) || cancelled) return;
      const measured = new Map<string, { from: string; mins: number; mode: "walk" | "ride" }>();
      for (const day of latest.current.days) {
        const hops = hopsOf(latest.current, day).filter((h) => routable(h.from) && routable(h.to));
        if (!hops.length) continue;
        // Route the day as chains of consecutive located stops.
        const stops = [...new Map(hops.flatMap((h) => [h.from, h.to]).map((a) => [a.id, a])).values()];
        const points = new Map<string, { lat: number; lon: number }>();
        await Promise.all(stops.map(async (a) => {
          const p = await pointOf(a, day.city);
          if (p) points.set(a.id, p);
        }));
        const located = hops.filter((h) => points.has(h.from.id) && points.has(h.to.id));
        if (!located.length || cancelled) continue;
        for (const chain of chainsOf(located)) {
          const res = await fetch("/api/route", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ points: [chain[0].from, ...chain.map((h) => h.to)].map((a) => points.get(a.id)) }),
          }).catch(() => undefined);
          if (!res?.ok) continue;
          const { legs } = (await res.json()) as { legs: ({ minutes: number; mode: "walk" | "ride" } | null)[] };
          chain.forEach((h, i) => {
            const leg = legs[i];
            if (leg) measured.set(h.to.id, { from: h.from.id, mins: leg.minutes, mode: leg.mode });
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
