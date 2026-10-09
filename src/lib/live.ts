import type { Activity, Day, Slot, Trip } from "./types.ts";

/** Giro Live: day-of logic. Pure functions so they can be tested without a clock or network. */

export const SLOT_HOURS: Record<Slot, [number, number]> = { morning: [8, 12], afternoon: [12, 18], evening: [18, 23] };

export function slotAt(hour: number): Slot | "late" | "early" {
  if (hour < SLOT_HOURS.morning[0]) return "early";
  if (hour < SLOT_HOURS.afternoon[0]) return "morning";
  if (hour < SLOT_HOURS.evening[0]) return "afternoon";
  if (hour < SLOT_HOURS.evening[1]) return "evening";
  return "late";
}

const OUTDOOR = /\b(park|garden|gardens|beach|hike|hiking|walk|trek|cruise|sail|bike|cycling|kayak|surf|snorkel|viewpoint|lookout|sunset|sunrise|stroll|wander|square|bridge|island|falls|waterfall|mountain|climb|trail|zoo|safari|vineyard|wine day|lagoon|glacier|cenote|terraces|forest|grove|seawall|coast|harbour|harbor|rooftop|ruins|pyramid|day trip)(es|s)?\b/i;
const INDOOR = /\b(museum|gallery|galleries|class|show|theatre|theater|cinema|spa|hammam|onsen|sento|jjimjilbang|bath|aquarium|food hall|foodhallen|tasting|distillery|storehouse|cabaret|jazz|flamenco|concert|opera|library|cistern|bar crawl|bars|pub|tavern|teamlab|basilica|cathedral|chapel|mosque|science)(es|s)?\b/i;

/** Rough indoor/outdoor classification from category and wording, used for rain plans. */
export function exposure(a: Pick<Activity, "title" | "description" | "category">): "outdoor" | "indoor" | "mixed" {
  const text = `${a.title} ${a.description}`;
  const indoor = INDOOR.test(text);
  const outdoor = OUTDOOR.test(text) || a.category === "nature" || a.category === "adventure";
  if (indoor && !outdoor) return "indoor";
  if (outdoor && !indoor) return "outdoor";
  if (a.category === "transit" || a.category === "free") return "mixed";
  return indoor ? "mixed" : a.category === "art" || a.category === "history" ? "indoor" : "mixed";
}

export interface HourlyRain {
  /** Local hour (0-23) → precipitation probability (0-100). */
  [hour: number]: number;
}

/** Highest rain probability within a slot's hours. */
export function slotRain(hourly: HourlyRain, slot: Slot): number {
  const [from, to] = SLOT_HOURS[slot];
  let max = 0;
  for (let h = from; h < to; h++) max = Math.max(max, hourly[h] ?? 0);
  return max;
}

export interface RainRisk {
  activity: Activity;
  chance: number;
}

/** Outdoor plans likely to get wet (≥ threshold % chance in their slot). */
export function rainRisks(day: Day, hourly: HourlyRain, threshold = 55): RainRisk[] {
  return day.activities
    .filter((a) => exposure(a) === "outdoor")
    .map((a) => ({ activity: a, chance: slotRain(hourly, a.slot) }))
    .filter((r) => r.chance >= threshold);
}

/** The day today falls on, if it's within the trip. */
export function dayForDate(trip: Trip, isoDate: string): Day | undefined {
  return trip.days.find((d) => d.date === isoDate);
}

/** Current and next activities for a given hour. */
export function nowAndNext(day: Day, hour: number): { now?: Activity; next?: Activity } {
  const order: Slot[] = ["morning", "afternoon", "evening"];
  const slot = slotAt(hour);
  const items = day.activities.filter((a) => a.category !== "free");
  if (slot === "early") return { next: items[0] };
  if (slot === "late") return {};
  const idx = order.indexOf(slot);
  const now = items.find((a) => a.slot === slot);
  const next = items.find((a) => order.indexOf(a.slot) > idx) ?? (now ? items[items.indexOf(now) + 1] : undefined);
  return { now, next: next === now ? undefined : next };
}

/** For "running late": the lightest later day in the same city that could absorb a stop. */
export function lightestLaterDay(trip: Trip, fromIndex: number): Day | undefined {
  const from = trip.days[fromIndex];
  if (!from) return undefined;
  const busy = (d: Day) => d.activities.filter((a) => a.category !== "free" && a.category !== "transit").reduce((s, a) => s + a.durationHrs, 0);
  return trip.days
    .filter((d) => d.index > fromIndex && d.city === from.city && d.index < trip.days.length - 1)
    .sort((a, b) => busy(a) - busy(b) || a.index - b.index)[0];
}

/** Move an activity to another day, replacing a free slot there when one exists. */
export function moveActivity(trip: Trip, fromIndex: number, activityId: string, toIndex: number): Trip {
  const act = trip.days[fromIndex]?.activities.find((a) => a.id === activityId);
  if (!act || fromIndex === toIndex) return trip;
  const order: Record<Slot, number> = { morning: 0, afternoon: 1, evening: 2 };
  return {
    ...trip,
    days: trip.days.map((d) => {
      if (d.index === fromIndex) return { ...d, activities: d.activities.filter((a) => a.id !== activityId) };
      if (d.index !== toIndex) return d;
      const free = d.activities.find((a) => a.category === "free" && (a.slot === act.slot || act.slot !== "evening"));
      const moved = { ...act, slot: free?.slot ?? act.slot };
      const rest = free ? d.activities.filter((a) => a.id !== free.id) : d.activities;
      return { ...d, activities: [...rest, moved].sort((x, y) => order[x.slot] - order[y.slot]) };
    }),
  };
}

/** WMO weather code → short label. */
export function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}
