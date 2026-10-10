import { curateTrip, estimateBudget, freeTime, normalizeRequest, phrases, planLegs, resolveDestination, scoreActivity, toActivity, tripTitle } from "./curate.ts";
import { addDays, nightsBetween } from "./dates.ts";
import type { TasteProfile } from "./taste.ts";
import type { Activity, Day, ParkedIdea, Slot, Trip, TripRequest } from "./types.ts";

/**
 * Change a trip's dates or length while keeping what the traveller has built. Each city keeps
 * its arrival and departure days; days in between are kept in order, extra days are filled with
 * fresh picks that don't repeat the plan, and stops from removed days go to Ideas.
 */

export const MAX_NIGHTS = 29;

export interface Reschedule {
  trip: Trip;
  /** Stops moved to Ideas because their day no longer exists. */
  parked: ParkedIdea[];
  addedDays: number;
  warnings: string[];
}

/** Consecutive days in the same city: one per leg of the trip. */
function runs(days: Day[]): Day[][] {
  const out: Day[][] = [];
  for (const d of days) {
    const last = out.at(-1);
    if (last && last[0].city === d.city) last.push(d);
    else out.push([d]);
  }
  return out;
}

const keyOf = (a: { ref?: string; title: string }) => a.ref ?? a.title.toLowerCase();

/** The best catalog stop for a slot that isn't in the trip yet (day trips excluded: they'd crowd out the day). */
function bestUnused(req: TripRequest, city: string, slot: Slot, used: Set<string>, taste?: TasteProfile): Activity | undefined {
  const dest = resolveDestination(city);
  const ctx = { req, must: phrases(req.mustSee), avoid: phrases(req.avoid), catalogSize: dest.activities.length, taste };
  const pick = dest.activities
    .map((act, i) => ({ act, score: scoreActivity(act, i, ctx) }))
    .filter(({ act, score }) => Number.isFinite(score) && !used.has(act.key) && act.hrs < 6 && (slot === "evening" ? act.slot === "evening" : act.slot !== "evening"))
    .sort((a, b) => b.score - a.score)[0];
  return pick ? toActivity(pick.act, slot) : undefined;
}

/** Fill a new day from its fresh skeleton without repeating anything already planned. */
function fillNewDay(skeleton: Day, req: TripRequest, used: Set<string>, taste?: TasteProfile): Day {
  const filled = skeleton.activities.map((a) => {
    if (a.category === "transit" || a.category === "free") return a;
    const pick = used.has(keyOf(a)) ? bestUnused(req, skeleton.city, a.slot, used, taste) : a;
    if (!pick) return freeTime(skeleton.city, a.slot);
    used.add(keyOf(pick));
    return pick;
  });
  // Once the city's best picks are all planned, daytime gaps become one open block that points to Ideas.
  const daytimeFree = filled.filter((a) => a.category === "free" && a.slot !== "evening");
  let activities = filled;
  if (daytimeFree.length > 1) {
    const block: Activity = {
      ...daytimeFree[0],
      title: `Free time in ${skeleton.city}`,
      description: "Unplanned time. Browse Ideas for things to add, or add your own stop.",
      area: undefined,
      durationHrs: Math.min(8, daytimeFree.reduce((s, a) => s + a.durationHrs, 0)),
    };
    activities = filled.filter((a) => !daytimeFree.includes(a) || a === daytimeFree[0]).map((a) => (a === daytimeFree[0] ? block : a));
  }
  const open = activities.every((a) => a.category === "free" || a.category === "transit");
  return { ...skeleton, activities, theme: open ? `A free day in ${skeleton.city}` : skeleton.theme };
}

export function rescheduleCheck(trip: Trip, start: string, end: string): string | undefined {
  const nights = nightsBetween(start, end);
  if (!Number.isFinite(nights) || nights < 1) return "The trip needs to end after it starts.";
  if (nights > MAX_NIGHTS) return `Giro plans trips of up to ${MAX_NIGHTS} nights.`;
  const cities = trip.request.destinations.length;
  if (cities > nights) return `${cities} cities need at least ${cities} nights.`;
  return undefined;
}

export function rescheduleTrip(trip: Trip, start: string, end: string, taste?: TasteProfile): Reschedule {
  const problem = rescheduleCheck(trip, start, end);
  if (problem) throw new Error(problem);
  const req = normalizeRequest({ ...trip.request, startDate: start, endDate: end });
  const sameLength = nightsBetween(start, end) === nightsBetween(trip.request.startDate, trip.request.endDate);

  let days: Day[];
  const parked: ParkedIdea[] = [];
  let addedDays = 0;

  if (sameLength) {
    // Just moving the trip: every day keeps its plan on its new date.
    days = trip.days.map((d, i) => ({ ...d, index: i, date: addDays(start, i) }));
  } else {
    // A fresh plan for the new dates supplies the day skeleton and picks for any new days.
    const fresh = curateTrip(req, { fx: trip.fx, taste });
    const oldRuns = runs(trip.days);
    const newRuns = runs(fresh.days);
    if (oldRuns.length !== newRuns.length) {
      // Cities don't line up (e.g. a city was squeezed out); keep it simple and honest.
      throw new Error("Changing the length would change which cities you visit. Use Edit details to re-plan instead.");
    }
    const used = new Set(trip.days.flatMap((d) => d.activities.filter((a) => a.category !== "transit").map(keyOf)));
    const out: Day[] = [];
    oldRuns.forEach((old, r) => {
      const next = newRuns[r];
      const m = next.length;
      const keep: (Day | undefined)[] = new Array(m).fill(undefined);
      if (m === 1) {
        keep[0] = old.length === 1 ? old[0] : undefined;
      } else {
        keep[0] = old[0];
        if (old.length > 1) keep[m - 1] = old.at(-1);
        const middles = old.slice(1, old.length > 1 ? -1 : undefined);
        for (let i = 1; i < m - 1 && middles.length; i++) keep[i] = middles.shift();
        // Days that no longer fit: their stops wait in Ideas.
        for (const d of middles) for (const a of d.activities) if (a.category !== "transit" && a.category !== "free") parked.push({ ...a, start: undefined, city: d.city, reason: "Trip shortened" });
      }
      if (m === 1 && old.length > 1) {
        for (const d of old) for (const a of d.activities) if (a.category !== "transit" && a.category !== "free") parked.push({ ...a, start: undefined, city: d.city, reason: "Trip shortened" });
      }
      next.forEach((slot, i) => {
        const kept = keep[i];
        if (kept) {
          out.push({ ...kept, index: slot.index, date: slot.date });
        } else {
          addedDays++;
          out.push(fillNewDay(slot, req, used, taste));
        }
      });
    });
    days = out;
  }

  const legs = planLegs(req);
  const stays = legs.map((l, i) => {
    const old = trip.stays[i];
    return { city: l.city, checkIn: l.checkIn, checkOut: l.checkOut, nights: l.nights, area: old?.area ?? "", why: old?.why ?? "", booking: old?.city === l.city ? old.booking : undefined };
  });

  const warnings: string[] = [];
  const outbound = trip.flights?.find((f) => f.kind === "outbound");
  const ret = trip.flights?.find((f) => f.kind === "return");
  if ((outbound && outbound.departDate !== start && outbound.arriveDate !== start) || (ret && ret.departDate !== end)) {
    warnings.push("Your booked flights keep their dates. Update them in Flights & stays if they've changed too.");
  }
  if (stays.some((s) => s.booking)) warnings.push("Check your hotel bookings match the new dates.");

  const autoTitle = trip.title === tripTitle(planLegs(trip.request), trip.days.length);
  const next: Trip = {
    ...trip,
    request: req,
    title: autoTitle ? tripTitle(legs, days.length) : trip.title,
    days,
    stays,
    parked: [...(trip.parked ?? []), ...parked],
  };
  return { trip: { ...next, budget: estimateBudget(req, legs, days) }, parked, addedDays, warnings };
}
