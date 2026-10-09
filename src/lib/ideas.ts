import { findDestination, type CatalogActivity } from "./destinations.ts";
import { genericDestination, phrases, resolveDestination, scoreActivity, toActivity } from "./curate.ts";
import type { TasteProfile } from "./taste.ts";
import type { Activity, Interest, ParkedIdea, Slot, Trip } from "./types.ts";

export interface Idea extends Activity {
  city: string;
  /** "parked" = moved out of the plan; "catalog" = a suggestion not yet in the plan. */
  origin: "parked" | "catalog";
  reason?: string;
  categories: Interest[];
}

const defaultSlot = (a: CatalogActivity): Slot => (a.slot === "any" ? "afternoon" : a.slot);

/** Attractions for a city that aren't in the plan yet: parked items first, then ranked suggestions. */
export function ideasFor(trip: Trip, city: string, taste?: TasteProfile): Idea[] {
  const inPlan = new Set(trip.days.flatMap((d) => d.activities.flatMap((a) => [a.ref, a.title.toLowerCase()].filter(Boolean) as string[])));
  const parked: Idea[] = (trip.parked ?? [])
    .filter((p) => p.city === city)
    .map((p: ParkedIdea) => ({ ...p, origin: "parked" as const, categories: p.category === "transit" || p.category === "free" ? [] : [p.category] }));
  const parkedKeys = new Set(parked.flatMap((p) => [p.ref, p.title.toLowerCase()].filter(Boolean) as string[]));

  const dest = resolveDestination(city);
  const ctx = { req: trip.request, must: phrases(trip.request.mustSee), avoid: phrases(trip.request.avoid), catalogSize: dest.activities.length, taste };
  const rank = (pool: CatalogActivity[]) => pool
    .map((act, i) => ({ act, score: scoreActivity(act, i, ctx) }))
    .filter(({ act, score }) => Number.isFinite(score) && !inPlan.has(act.key) && !inPlan.has(act.title.toLowerCase()) && !parkedKeys.has(act.key))
    .sort((a, b) => b.score - a.score)
    // Stable ids so drag-and-drop can track suggestions across renders.
    .map(({ act }) => ({ ...toActivity(act, defaultSlot(act)), id: `cat:${act.key}`, city, origin: "catalog" as const, categories: act.cats }));
  let catalog: Idea[] = rank(dest.activities);
  // Open-ended ideas ("a cooking class", "the main market") only when curated picks run low.
  if (findDestination(city) && catalog.length < 4) catalog = [...catalog, ...rank(genericDestination(city).activities.slice(0, 6))];
  return [...parked, ...catalog];
}

/** Turn an idea into a fresh plan activity (new id, no pinned time). */
export function ideaToActivity(idea: Idea, id: string, slot: Slot): Activity {
  const { city: _c, origin: _o, reason: _r, categories: _k, ...rest } = idea;
  return { ...rest, id, slot, start: undefined };
}
