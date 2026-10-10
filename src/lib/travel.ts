import type { Activity, Day, Trip } from "./types.ts";

/** Measured travel between stops: which pairs to measure, and saving the results on the trip. */

export interface Hop {
  from: Activity;
  to: Activity;
}

/** Consecutive stops the scheduler times from one to the next (travel placeholders skipped when flights are known). */
export function hopsOf(trip: Pick<Trip, "flights">, day: Day): Hop[] {
  const hasFlights = (trip.flights ?? []).length > 0;
  const seq = day.activities.filter((a) => !(hasFlights && a.category === "transit"));
  return seq.slice(1).map((to, i) => ({ from: seq[i], to }));
}

/** Split hops into runs where each starts where the last ended (at most `max` hops per run). */
export function chainsOf(hops: Hop[], max = 11): Hop[][] {
  const out: Hop[][] = [];
  for (const h of hops) {
    const last = out.at(-1);
    if (last && last.at(-1)!.to.id === h.from.id && last.length < max) last.push(h);
    else out.push([h]);
  }
  return out;
}

/** Only real places can be routed: not travel placeholders or free time without an area. */
export const routable = (a: Activity) => a.category !== "transit" && !(a.category === "free" && !a.area);

/**
 * Record measured hops (by the destination stop's id). Returns the same trip object when nothing
 * meaningfully changed, so callers can skip saving.
 */
export function withTravel(trip: Trip, measured: Map<string, { from: string; mins: number; mode: "walk" | "ride" }>): Trip {
  let changed = false;
  const days = trip.days.map((d) => {
    let dayChanged = false;
    const activities = d.activities.map((a) => {
      const m = measured.get(a.id);
      if (!m) return a;
      const t = a.travel;
      if (t && t.from === m.from && t.mode === m.mode && Math.abs(t.mins - m.mins) < 2) return a;
      dayChanged = true;
      return { ...a, travel: m };
    });
    if (!dayChanged) return d;
    changed = true;
    return { ...d, activities };
  });
  return changed ? { ...trip, days } : trip;
}
