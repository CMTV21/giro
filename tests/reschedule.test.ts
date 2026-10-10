import assert from "node:assert/strict";
import { test } from "node:test";
import { curateTrip } from "../src/lib/curate.ts";
import { rescheduleCheck, rescheduleTrip } from "../src/lib/reschedule.ts";
import { TripSchema } from "../src/lib/trip-schema.ts";
import type { TripRequest } from "../src/lib/types.ts";

const req: TripRequest = { destinations: ["Lisbon"], origin: "", startDate: "2026-05-10", endDate: "2026-05-15", adults: 2, children: 0, budgetTier: "comfort", pace: "balanced", interests: ["food", "history"], stayType: "hotel" };

const withEdit = () => {
  const trip = curateTrip(req);
  // A traveller edit on day 2 that must survive.
  return { ...trip, days: trip.days.map((d, i) => (i === 2 ? { ...d, activities: d.activities.map((a, k) => (k === 0 ? { ...a, note: "MINE" } : a)) } : d)) };
};
// Real stops only: travel legs and free-time placeholders can repeat.
const refs = (t: { days: { activities: { ref?: string; title: string; category: string }[] }[] }) => t.days.flatMap((d) => d.activities.filter((a) => a.category !== "transit" && a.category !== "free").map((a) => a.ref ?? a.title));

test("moving the dates keeps every day's plan", () => {
  const trip = withEdit();
  const r = rescheduleTrip(trip, "2026-06-01", "2026-06-06");
  assert.equal(r.trip.days.length, trip.days.length);
  assert.equal(r.trip.days[0].date, "2026-06-01");
  assert.equal(r.trip.days.at(-1)!.date, "2026-06-06");
  assert.deepEqual(r.trip.days.map((d) => d.activities.map((a) => a.id)), trip.days.map((d) => d.activities.map((a) => a.id)));
  assert.equal(r.trip.stays[0].checkIn, "2026-06-01");
  assert.equal(r.parked.length, 0);
});

test("lengthening keeps edits, adds fresh non-repeating days, keeps departure last", () => {
  const trip = withEdit();
  const r = rescheduleTrip(trip, "2026-05-10", "2026-05-18");
  assert.equal(r.trip.days.length, 9);
  assert.equal(r.addedDays, 3);
  assert.ok(r.trip.days.some((d) => d.activities.some((a) => a.note === "MINE")));
  assert.match(r.trip.days.at(-1)!.theme, /Farewell/);
  assert.equal(r.trip.days.at(-1)!.activities.at(-1)!.category, "transit");
  const all = refs(r.trip);
  assert.equal(new Set(all).size, all.length, "no stop appears twice");
  assert.deepEqual(r.trip.days.map((d) => d.index), [...Array(9).keys()]);
  assert.ok(r.trip.days.every((d) => d.activities.length > 0), "no empty days");
  assert.equal(r.trip.title, "9 days in Lisbon", "automatic title follows the length");
  assert.ok(TripSchema.safeParse(r.trip).success);
});

test("shortening keeps arrival and departure and moves the rest to Ideas", () => {
  const trip = withEdit();
  const before = refs(trip);
  const r = rescheduleTrip(trip, "2026-05-10", "2026-05-12");
  assert.equal(r.trip.days.length, 3);
  assert.match(r.trip.days[0].theme, /Arrive/);
  assert.match(r.trip.days.at(-1)!.theme, /Farewell/);
  const kept = refs(r.trip);
  const parked = r.parked.map((p) => p.ref ?? p.title);
  assert.ok(parked.length > 0 && r.parked.every((p) => p.reason === "Trip shortened"));
  assert.deepEqual([...kept, ...parked].sort(), [...before].sort(), "nothing is lost");
  assert.ok(r.trip.budget.total < trip.budget.total);
});

test("multi-city trips change per city and keep hotel bookings", () => {
  const trip = curateTrip({ ...req, destinations: ["Rome", "Florence"], endDate: "2026-05-16" });
  const booked = { ...trip, stays: trip.stays.map((s, i) => (i === 1 ? { ...s, booking: { name: "Hotel Ponte" } } : s)) };
  const r = rescheduleTrip(booked, "2026-05-10", "2026-05-19");
  assert.deepEqual([...new Set(r.trip.days.map((d) => d.city))], ["Rome", "Florence"]);
  assert.equal(r.trip.stays[1].booking?.name, "Hotel Ponte");
  assert.ok(r.warnings.some((w) => /hotel/i.test(w)));
});

test("bad ranges are refused with a reason", () => {
  const trip = curateTrip({ ...req, destinations: ["Rome", "Florence", "Venice"], endDate: "2026-05-16" });
  assert.match(rescheduleCheck(trip, "2026-05-10", "2026-05-10")!, /end after/);
  assert.match(rescheduleCheck(trip, "2026-05-10", "2026-05-12")!, /3 cities/);
  assert.match(rescheduleCheck(trip, "2026-05-10", "2026-07-10")!, /29 nights/);
  assert.throws(() => rescheduleTrip(trip, "2026-05-10", "2026-05-10"));
});
