import { newId } from "./curate.ts";
import { ideaToActivity, type Idea } from "./ideas.ts";
import type { Activity, Slot, Trip } from "./types.ts";

/** Itinerary edits used by drag-and-drop and buttons. Pure: each returns a new trip. */

function slotAt(list: Activity[], index: number, fallback: Slot): Slot {
  const before = list[index - 1];
  const after = list[index];
  return before?.slot ?? after?.slot ?? fallback;
}

const insertAt = (list: Activity[], a: Activity, beforeId?: string) => {
  const i = beforeId ? list.findIndex((x) => x.id === beforeId) : -1;
  let at = i < 0 ? list.length : i;
  // The departure placeholder stays last, so new stops land before it.
  if (list.at(-1)?.category === "transit" && list.length > 1 && i < 0) at = list.length - 1;
  // Evening experiences (shows, dinners, nightlife) stay in the evening wherever they're dropped.
  if (a.slot === "evening") {
    const firstEvening = list.findIndex((x) => x.slot === "evening");
    const lastDay = list.findLastIndex((x) => x.slot !== "evening" && x.category !== "transit");
    at = Math.max(at, lastDay + 1, firstEvening < 0 ? 0 : Math.min(at, firstEvening));
    if (list[at - 1]?.category === "transit" && at === list.length) at = Math.max(0, at - 1);
    return { list: [...list.slice(0, at), a, ...list.slice(at)], slot: "evening" as Slot };
  }
  const slot = slotAt(list, at, a.slot);
  return { list: [...list.slice(0, at), { ...a, slot }, ...list.slice(at)], slot };
};

export function parkActivity(trip: Trip, dayIndex: number, activityId: string, reason: string): Trip {
  const day = trip.days[dayIndex];
  const a = day?.activities.find((x) => x.id === activityId);
  if (!a || a.category === "transit") return trip;
  const parked = a.category === "free" ? trip.parked ?? [] : [...(trip.parked ?? []), { ...a, start: undefined, city: day.city, reason }];
  return { ...trip, parked, days: trip.days.map((d) => (d.index === dayIndex ? { ...d, activities: d.activities.filter((x) => x.id !== activityId) } : d)) };
}

export function insertIdea(trip: Trip, idea: Idea, dayIndex: number, beforeId?: string): { trip: Trip; error?: string } {
  const day = trip.days[dayIndex];
  if (!day) return { trip };
  if (day.city !== idea.city) return { trip, error: `${idea.title} is in ${idea.city}, but day ${dayIndex + 1} is in ${day.city}.` };
  const fresh = ideaToActivity(idea, newId(), idea.slot);
  const { list } = insertAt(day.activities, fresh, beforeId);
  return {
    trip: {
      ...trip,
      parked: idea.origin === "parked" ? (trip.parked ?? []).filter((p) => p.id !== idea.id) : trip.parked,
      days: trip.days.map((d) => (d.index === dayIndex ? { ...d, activities: list } : d)),
    },
  };
}

/** Move a stop within a day or to another day in the same city. */
export function moveStop(trip: Trip, fromDay: number, activityId: string, toDay: number, beforeId?: string): { trip: Trip; error?: string } {
  const src = trip.days[fromDay];
  const dst = trip.days[toDay];
  const a = src?.activities.find((x) => x.id === activityId);
  if (!a || !dst || beforeId === activityId) return { trip };
  if (src.city !== dst.city) return { trip, error: `${a.title} is in ${src.city}; day ${toDay + 1} is in ${dst.city}.` };
  if (fromDay === toDay) {
    const without = src.activities.filter((x) => x.id !== activityId);
    const { list } = insertAt(without, { ...a, start: undefined }, beforeId);
    // Keep the day's slot sequence in time order; the moved stop takes the slot of its new position.
    const slots = src.activities.map((x) => x.slot);
    const relabelled = a.slot === "evening" ? list : list.map((x, k) => ({ ...x, slot: slots[k] ?? x.slot }));
    return { trip: { ...trip, days: trip.days.map((d) => (d.index === fromDay ? { ...d, activities: relabelled } : d)) } };
  }
  const { list } = insertAt(dst.activities, { ...a, start: undefined }, beforeId);
  return {
    trip: {
      ...trip,
      days: trip.days.map((d) => (d.index === fromDay ? { ...d, activities: d.activities.filter((x) => x.id !== activityId) } : d.index === toDay ? { ...d, activities: list } : d)),
    },
  };
}

export const dismissIdea = (trip: Trip, id: string): Trip => ({ ...trip, parked: (trip.parked ?? []).filter((p) => p.id !== id) });

export function setStart(trip: Trip, dayIndex: number, activityId: string, hhmm: string | undefined): Trip {
  return { ...trip, days: trip.days.map((d) => (d.index === dayIndex ? { ...d, activities: d.activities.map((a) => (a.id === activityId ? { ...a, start: hhmm } : a)) } : d)) };
}

const SLOT_ORDER: Record<Slot, number> = { morning: 0, afternoon: 1, evening: 2 };

/**
 * Add a ready-made stop (e.g. a restaurant from the food guide) to a day, keeping its slot: a
 * lunch goes before the afternoon's sights, a dinner before the evening's, breakfast first.
 */
export function addActivity(trip: Trip, dayIndex: number, activity: Activity): Trip {
  const day = trip.days[dayIndex];
  if (!day) return trip;
  const list = day.activities;
  const want = SLOT_ORDER[activity.slot];
  let at = list.findIndex((x) => x.category !== "transit" && SLOT_ORDER[x.slot] >= want);
  if (at < 0) at = list.length;
  // Arrival stays first and departure stays last.
  if (at === 0 && list[0]?.category === "transit" && list.length > 1) at = 1;
  if (at === list.length && list.at(-1)?.category === "transit" && list.length > 1) at = list.length - 1;
  const next = [...list.slice(0, at), activity, ...list.slice(at)];
  return { ...trip, days: trip.days.map((d) => (d.index === dayIndex ? { ...d, activities: next } : d)) };
}
