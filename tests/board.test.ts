import assert from "node:assert/strict";
import { test } from "node:test";
import { lengthLabel, minutesAt, placeAtTime, setDuration, slotForTime, snap } from "../src/lib/board.ts";
import { curateTrip } from "../src/lib/curate.ts";
import { ideasFor } from "../src/lib/ideas.ts";
import { scheduleDay, toMinutes } from "../src/lib/schedule.ts";
import type { Trip, TripRequest } from "../src/lib/types.ts";

const base: TripRequest = {
  destinations: ["Lisbon"],
  origin: "",
  startDate: "2026-05-10",
  endDate: "2026-05-14",
  adults: 2,
  children: 0,
  budgetTier: "comfort",
  pace: "balanced",
  interests: ["food", "history"],
  stayType: "hotel",
};

const stopsOf = (t: Trip, day: number) => t.days[day].activities.filter((a) => a.category !== "transit");
const startOf = (t: Trip, day: number, id: string) => scheduleDay(t, t.days[day]).find((i) => i.activity?.id === id)!.start;

test("snapping and time maths", () => {
  assert.equal(snap(607), 600);
  assert.equal(snap(608), 615);
  assert.equal(minutesAt(0, 0.8), 7 * 60);
  assert.equal(minutesAt(240 * 0.8, 0.8), 11 * 60);
  assert.deepEqual([slotForTime(600), slotForTime(720), slotForTime(1080)], ["morning", "afternoon", "evening"]);
  assert.deepEqual([lengthLabel(45), lengthLabel(90), lengthLabel(180)], ["45 min", "1 h 30 min", "3 h"]);
});

test("dropping a stop on another day pins it at that time, in time order", () => {
  const trip = curateTrip(base);
  const moving = stopsOf(trip, 1)[0];
  const { trip: next, error } = placeAtTime(trip, { kind: "stop", dayIndex: 1, activityId: moving.id }, 2, 14 * 60 + 7);
  assert.equal(error, undefined);
  assert.ok(!next.days[1].activities.some((a) => a.id === moving.id), "left the old day");
  const placed = next.days[2].activities.find((a) => a.id === moving.id)!;
  assert.equal(placed.start, "14:00", "snapped to 15 minutes");
  assert.equal(placed.slot, "afternoon");
  assert.equal(startOf(next, 2, moving.id), 14 * 60);
  const starts = scheduleDay(next, next.days[2]).filter((i) => i.kind === "activity").map((i) => i.start);
  const order = next.days[2].activities.map((a) => startOf(next, 2, a.id));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "the day's list stays in time order");
  assert.ok(starts.length >= 3);
});

test("moving within a day, arrival first and departure last", () => {
  const trip = curateTrip(base);
  const first = stopsOf(trip, 0)[0];
  const { trip: next } = placeAtTime(trip, { kind: "stop", dayIndex: 0, activityId: first.id }, 0, 20 * 60);
  const acts = next.days[0].activities;
  assert.equal(acts[0].category, "transit", "arrival stays first");
  assert.equal(acts.find((a) => a.id === first.id)!.start, "20:00");
  assert.equal(acts.length, trip.days[0].activities.length, "nothing lost or duplicated");

  const last = trip.days.length - 1;
  const early = stopsOf(trip, last)[0] ?? stopsOf(trip, 1)[0];
  const from = stopsOf(trip, last)[0] ? last : 1;
  const { trip: n2 } = placeAtTime(trip, { kind: "stop", dayIndex: from, activityId: early.id }, last, 23 * 60);
  assert.equal(n2.days[last].activities.at(-1)!.category, "transit", "departure stays last");
});

test("late drops are pulled back so the stop ends by midnight", () => {
  const trip = curateTrip(base);
  const a = stopsOf(trip, 1)[0];
  const { trip: next } = placeAtTime(trip, { kind: "stop", dayIndex: 1, activityId: a.id }, 1, 23 * 60 + 45);
  const placed = next.days[1].activities.find((x) => x.id === a.id)!;
  assert.ok(toMinutes(placed.start!)! + placed.durationHrs * 60 <= 24 * 60);
});

test("ideas can be dropped at a time; parked ideas leave the Ideas list", () => {
  const trip = curateTrip(base);
  const idea = ideasFor(trip, "Lisbon")[0];
  const { trip: next } = placeAtTime(trip, { kind: "idea", idea }, 2, 10 * 60);
  const added = next.days[2].activities.find((a) => a.title === idea.title)!;
  assert.equal(added.start, "10:00");
  assert.equal(added.slot, "morning");
  assert.notEqual(added.id, idea.id, "a fresh plan id");

  const parkedTrip: Trip = { ...trip, parked: [{ ...stopsOf(trip, 1)[0], id: "p1", city: "Lisbon", reason: "Removed by you" }] };
  const parkedIdea = ideasFor(parkedTrip, "Lisbon").find((i) => i.id === "p1")!;
  const { trip: n2 } = placeAtTime(parkedTrip, { kind: "idea", idea: parkedIdea }, 3, 15 * 60);
  assert.equal(n2.parked!.length, 0);
});

test("refuses other cities and travel placeholders", () => {
  const trip = curateTrip({ ...base, destinations: ["Lisbon", "Porto"], endDate: "2026-05-16" });
  const portoDay = trip.days.findIndex((d) => d.city === "Porto" && d.activities.some((a) => a.category !== "transit"));
  const a = stopsOf(trip, 1)[0];
  const r = placeAtTime(trip, { kind: "stop", dayIndex: 1, activityId: a.id }, portoDay, 600);
  assert.match(r.error!, /Lisbon/);
  assert.equal(r.trip, trip);
  const arrival = trip.days[0].activities[0];
  assert.match(placeAtTime(trip, { kind: "stop", dayIndex: 0, activityId: arrival.id }, 1, 600).error!, /Travel/);
});

test("stretching a stop changes its length in 15-minute steps, within limits", () => {
  const trip = curateTrip(base);
  const a = stopsOf(trip, 1)[0];
  assert.equal(setDuration(trip, 1, a.id, 100).days[1].activities.find((x) => x.id === a.id)!.durationHrs, 1.75);
  assert.equal(setDuration(trip, 1, a.id, 2).days[1].activities.find((x) => x.id === a.id)!.durationHrs, 0.25);
  assert.equal(setDuration(trip, 1, a.id, 9999).days[1].activities.find((x) => x.id === a.id)!.durationHrs, 12);
});

test("a new stop added at a time on the board", () => {
  const trip = curateTrip(base);
  const custom = { id: "c1", title: "Meet Ana", description: "", category: "food" as const, slot: "afternoon" as const, durationHrs: 1, estCost: 0, custom: true };
  const { trip: next } = placeAtTime(trip, { kind: "new", activity: custom }, 1, 19 * 60 + 30);
  const added = next.days[1].activities.find((a) => a.id === "c1")!;
  assert.equal(added.start, "19:30");
  assert.equal(added.slot, "evening");
});
