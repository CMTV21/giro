import { newId } from "./curate.ts";
import { ideaToActivity, type Idea } from "./ideas.ts";
import { MAX_STOP_HOURS } from "./plan-edit.ts";
import { fromMinutes, scheduleDay } from "./schedule.ts";
import type { Activity, Slot, Trip } from "./types.ts";

/**
 * Edits for the multi-day board: drop a stop (or an idea) on any day at a clock time, and
 * stretch a stop to change its length. Pure, like plan-edit: each returns a new trip.
 */

export const BOARD_FROM = 7 * 60;
export const BOARD_TO = 24 * 60;
export const SNAP = 15;

export const snap = (mins: number, step = SNAP) => Math.round(mins / step) * step;

/** The latest start that still ends by midnight, so a dropped stop stays on its day. */
const clampStart = (mins: number, durationHrs: number) => Math.max(BOARD_FROM, Math.min(BOARD_TO - Math.max(SNAP, Math.round(durationHrs * 60)), mins));

export const slotForTime = (mins: number): Slot => (mins < 12 * 60 ? "morning" : mins < 18 * 60 ? "afternoon" : "evening");

/** Minutes at a vertical offset on the board, snapped. */
export const minutesAt = (offsetPx: number, pxPerMinute: number) => snap(BOARD_FROM + offsetPx / pxPerMinute);


export type BoardSource = { kind: "stop"; dayIndex: number; activityId: string } | { kind: "idea"; idea: Idea } | { kind: "new"; activity: Activity };

/**
 * Put a stop on a day at a time. The stop is pinned there (the board shows what you drop), takes
 * the slot that matches the time, and sits in the day's order by time, so the stops after it flow on.
 * Arrival stays first and departure last.
 */
export function placeAtTime(trip: Trip, source: BoardSource, toDay: number, minutes: number): { trip: Trip; error?: string } {
  const dst = trip.days[toDay];
  if (!dst) return { trip };
  let moving: Activity | undefined;
  let fromDay: number | undefined;
  if (source.kind === "stop") {
    const src = trip.days[source.dayIndex];
    moving = src?.activities.find((a) => a.id === source.activityId);
    if (!src || !moving) return { trip };
    if (moving.category === "transit") return { trip, error: "Travel stops stay where they are; add your flight times to move them." };
    if (src.city !== dst.city) return { trip, error: `${moving.title} is in ${src.city}; day ${toDay + 1} is in ${dst.city}.` };
    fromDay = source.dayIndex;
  } else if (source.kind === "new") {
    moving = source.activity;
  } else {
    if (source.idea.city !== dst.city) return { trip, error: `${source.idea.title} is in ${source.idea.city}, but day ${toDay + 1} is in ${dst.city}.` };
    moving = ideaToActivity(source.idea, newId(), slotForTime(minutes));
  }

  const start = snap(clampStart(minutes, moving.durationHrs));
  const placed: Activity = { ...moving, start: fromMinutes(start), slot: slotForTime(start) };
  const rest = dst.activities.filter((a) => a.id !== placed.id);

  // Where the remaining stops fall today, so the new one slots in by time.
  const times = new Map(scheduleDay(trip, { ...dst, activities: rest }).filter((i) => i.activity).map((i) => [i.activity!.id, i.start]));
  // Travel placeholders anchor the day: arrival (or "On to…") first, departure last on the final day.
  const lastDay = toDay === trip.days.length - 1;
  const isDeparture = (a: Activity) => a.category === "transit" && rest.at(-1)?.id === a.id && (lastDay || rest.length > 1);
  const isArrival = (a: Activity) => a.category === "transit" && rest[0]?.id === a.id && !isDeparture(a);
  let at = rest.findIndex((a) => !isArrival(a) && (isDeparture(a) || (times.get(a.id) ?? Infinity) > start));
  if (at < 0) at = rest.length;
  const list = [...rest.slice(0, at), placed, ...rest.slice(at)];

  return {
    trip: {
      ...trip,
      parked: source.kind === "idea" && source.idea.origin === "parked" ? (trip.parked ?? []).filter((p) => p.id !== source.idea.id) : trip.parked,
      days: trip.days.map((d) => {
        if (d.index === toDay) return { ...d, activities: list };
        if (d.index === fromDay) return { ...d, activities: d.activities.filter((a) => a.id !== placed.id) };
        return d;
      }),
    },
  };
}

/** Change a stop's length in 15-minute steps (15 minutes to 12 hours). */
export function setDuration(trip: Trip, dayIndex: number, activityId: string, minutes: number): Trip {
  const mins = Math.max(SNAP, Math.min(MAX_STOP_HOURS * 60, snap(minutes)));
  return {
    ...trip,
    days: trip.days.map((d) => (d.index === dayIndex ? { ...d, activities: d.activities.map((a) => (a.id === activityId ? { ...a, durationHrs: mins / 60 } : a)) } : d)),
  };
}

/** "1 h 30 min", "45 min", "3 h". */
export function lengthLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
}
