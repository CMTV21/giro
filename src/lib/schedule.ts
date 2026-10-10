import type { Activity, Day, Flight, Pace, ParkedIdea, Trip } from "./types.ts";

/**
 * Schedule engine: turns an ordered day of activities into clock times.
 *
 * - The day opens at a pace-based hour, or after landing (+90 min for bags and transfer).
 * - It closes at 23:00, or 3 hours before a departing flight.
 * - Travel between stops takes 20 min in the same area, 40 min across town.
 * - Lunch and dinner are placed around activities unless an activity is itself a meal.
 * - Pinned start times are honoured; overlaps and overruns are flagged, never hidden.
 */

export const DAY_START: Record<Pace, number> = { relaxed: 600, balanced: 540, packed: 510 };
export const DAY_END = 23 * 60;
const AFTER_LANDING = 90;
const BEFORE_FLIGHT = 180;
const BEFORE_FLIGHT_BETWEEN = 120;

export const toMinutes = (hhmm: string): number | undefined => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : undefined;
};

export const fromMinutes = (mins: number): string => {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** "9:00 a.m."-style label in Canadian English. */
export function clock(mins: number): string {
  const d = new Date(Date.UTC(2000, 0, 1, Math.floor(mins / 60) % 24, Math.round(mins % 60)));
  return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export interface DayWindow {
  /** Minutes from midnight. start >= end means no sightseeing time. */
  start: number;
  end: number;
  flights: { flight: Flight; part: "depart" | "arrive"; at: number }[];
  /** Why the window is shorter than usual, in plain words. */
  notes: string[];
  inTransit: boolean;
}

/** Flights that touch this date, and the sightseeing window they leave. */
export function dayWindow(trip: Pick<Trip, "flights" | "request">, day: Pick<Day, "date">): DayWindow {
  let start = DAY_START[trip.request.pace] ?? DAY_START.balanced;
  let end = DAY_END;
  const notes: string[] = [];
  const flights: DayWindow["flights"] = [];
  let inTransit = false;

  for (const f of trip.flights ?? []) {
    const dep = toMinutes(f.departTime);
    const arr = toMinutes(f.arriveTime);
    const label = [f.airline, f.flightNumber].filter(Boolean).join(" ") || "Your flight";
    if (f.departDate === day.date && dep !== undefined) {
      flights.push({ flight: f, part: "depart", at: dep });
      if (f.kind !== "outbound") {
        const cutoff = dep - (f.kind === "between" ? BEFORE_FLIGHT_BETWEEN : BEFORE_FLIGHT);
        if (cutoff < end) {
          end = cutoff;
          notes.push(`${label} leaves ${f.from} at ${clock(dep)}; plans wrap up by ${clock(Math.max(0, cutoff))}`);
        }
      }
    }
    if (f.arriveDate === day.date && arr !== undefined) {
      flights.push({ flight: f, part: "arrive", at: arr });
      if (f.kind !== "return") {
        const open = arr + AFTER_LANDING;
        if (open > start) {
          start = open;
          notes.push(`${label} lands in ${f.to} at ${clock(arr)}; plans start from ${clock(Math.min(open, 24 * 60 - 1))}`);
        }
      }
    }
    // Strictly inside a flight's span (an overnight or multi-day journey): no sightseeing that day.
    if (f.kind !== "return" && day.date < f.arriveDate && day.date >= f.departDate) {
      inTransit = true;
      if (f.departDate !== day.date) notes.push(`You're in the air on the way to ${f.to}.`);
    }
    if (f.kind === "return" && day.date > f.departDate) {
      inTransit = true;
      notes.push("Your return flight has already left by this day.");
    }
  }
  if (inTransit) start = end;
  return { start, end, flights: flights.sort((a, b) => a.at - b.at), notes, inTransit };
}

export interface ScheduledItem {
  kind: "activity" | "meal" | "flight";
  start: number;
  end: number;
  label: string;
  activity?: Activity;
  /** Set when a pinned time overlaps the previous plan. */
  conflict?: string;
  /** Doesn't fit inside the day's window. */
  overflow?: boolean;
  pinned?: boolean;
}

const MEAL_WORDS = /\b(dinner|lunch|tasting|food tour|taco tour|tapas|kaiseki|omakase|cooking class|brunch|feast|crawl)\b/i;
const isMeal = (a: Activity) => MEAL_WORDS.test(`${a.title} ${a.description}`);

export function travelMinutes(from?: Activity, to?: Activity): number {
  if (!from || !to) return 0;
  return from.area && to.area && from.area === to.area ? 20 : 40;
}

/** Clock times for every activity of a day, plus meals and flight blocks. */
export function scheduleDay(trip: Pick<Trip, "flights" | "request">, day: Day, window: DayWindow = dayWindow(trip, day)): ScheduledItem[] {
  const items: ScheduledItem[] = [];
  const hasFlights = window.flights.length > 0;
  let cursor = window.start;
  let prev: Activity | undefined;
  let lunch = false;
  let dinner = false;

  const meal = (label: "Lunch" | "Dinner", at: number, mins: number) => {
    items.push({ kind: "meal", start: at, end: at + mins, label, overflow: at + mins > window.end });
    cursor = at + mins;
  };

  for (const a of day.activities) {
    // With real flight times, the flight block replaces the generic travel placeholder.
    if (a.category === "transit" && hasFlights) continue;
    const pinned = a.start ? toMinutes(a.start) : undefined;
    let earliest = cursor + travelMinutes(prev, a);
    if (a.slot === "afternoon") earliest = Math.max(earliest, 12 * 60);
    if (a.slot === "evening") earliest = Math.max(earliest, 18 * 60);

    // Lunch goes in the first gap after the morning, as long as it's still lunchtime.
    if (!lunch && pinned === undefined && a.slot !== "morning" && cursor <= 14 * 60 + 30 && !isMeal(a)) {
      meal("Lunch", Math.max(cursor + (prev ? 15 : 0), 12 * 60), 60);
      lunch = true;
      earliest = Math.max(cursor + 15, a.slot === "evening" ? 18 * 60 : a.slot === "afternoon" ? 12 * 60 : 0);
    }
    if (!dinner && a.slot === "evening" && pinned === undefined && !isMeal(a)) {
      meal("Dinner", Math.max(cursor + (prev ? 15 : 0), 18 * 60), 75);
      dinner = true;
      earliest = cursor + 15;
    }
    if (isMeal(a)) {
      if (a.slot === "evening") dinner = true;
      else lunch = true;
    }

    const start = pinned ?? earliest;
    const end = start + Math.round(a.durationHrs * 60);
    items.push({
      kind: "activity",
      start,
      end,
      label: a.title,
      activity: a,
      pinned: pinned !== undefined,
      conflict: pinned !== undefined && pinned < cursor ? "Starts before the previous stop ends." : undefined,
      overflow: start < window.start || end > window.end,
    });
    cursor = Math.max(cursor, end);
    prev = a;
  }

  if (!dinner && day.activities.length && cursor < 21 * 60 && !window.inTransit && window.end >= 19 * 60 + 75) {
    meal("Dinner", Math.max(cursor + 15, 19 * 60), 75);
  }

  for (const f of window.flights) {
    const dep = toMinutes(f.flight.departTime)!;
    const arr = toMinutes(f.flight.arriveTime)!;
    const sameDay = f.flight.departDate === f.flight.arriveDate;
    if (f.part === "depart") items.push({ kind: "flight", start: dep, end: sameDay ? arr : 24 * 60 - 1, label: `${f.flight.from} → ${f.flight.to}` });
    else if (!sameDay) items.push({ kind: "flight", start: arr, end: arr + 30, label: `Land in ${f.flight.to}` });
  }
  return items.sort((a, b) => a.start - b.start || (a.kind === "flight" ? -1 : 1));
}

/**
 * Re-fit a trip around its flights: overnight days become travel days, and anything that no
 * longer fits moves to the Ideas list (with a reason) instead of disappearing.
 */
export function fitToFlights(trip: Trip): { trip: Trip; moved: ParkedIdea[]; warnings: string[] } {
  const moved: ParkedIdea[] = [];
  const warnings: string[] = [];
  const flights = trip.flights ?? [];
  const outbound = flights.find((f) => f.kind === "outbound");
  const ret = flights.find((f) => f.kind === "return");
  const first = trip.days[0]?.date;
  const last = trip.days.at(-1)?.date;
  if (outbound && first && outbound.arriveDate > (trip.days[1]?.date ?? first)) warnings.push(`Your outbound flight lands on ${outbound.arriveDate}, more than a day after the trip starts. Use Change dates to move the trip.`);
  if (ret && last && ret.departDate !== last) warnings.push(`Your return flight leaves on ${ret.departDate}, but the itinerary ends on ${last}. Use Change dates to match them.`);

  let days = trip.days.map((d) => ({ ...d, activities: [...d.activities] }));

  // An overnight outbound flight: move the "Arrive in …" placeholder to the day you actually land.
  if (outbound && first && outbound.arriveDate > first) {
    const target = days.find((d) => d.date === outbound.arriveDate);
    const arrival = days[0].activities.find((a) => a.category === "transit");
    if (target && arrival && target.index !== 0) {
      days[0].activities = days[0].activities.filter((a) => a.id !== arrival.id);
      target.activities = [arrival, ...target.activities];
    }
  }

  days = days.map((d) => {
    const window = dayWindow(trip, d);
    const sched = scheduleDay(trip, d, window);
    const misfits = new Set(sched.filter((i) => i.kind === "activity" && i.overflow && i.activity!.category !== "transit").map((i) => i.activity!.id));
    if (window.inTransit) for (const a of d.activities) if (a.category !== "transit") misfits.add(a.id);
    if (!misfits.size && !window.inTransit) return d;
    const reason = window.inTransit ? "You're travelling this day" : window.notes.at(-1) ?? "Didn't fit the day";
    for (const a of d.activities) if (misfits.has(a.id) && a.category !== "free") moved.push({ ...a, city: d.city, reason, start: undefined });
    return {
      ...d,
      theme: window.inTransit ? `Travel to ${outbound?.to ?? d.city}` : d.theme,
      activities: d.activities.filter((a) => !misfits.has(a.id)),
    };
  });

  return { trip: { ...trip, days, parked: [...(trip.parked ?? []), ...moved] }, moved, warnings };
}
