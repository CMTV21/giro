import assert from "node:assert/strict";
import { test } from "node:test";
import { curateTrip } from "../src/lib/curate.ts";
import { clock, dayWindow, fitToFlights, scheduleDay, toMinutes } from "../src/lib/schedule.ts";
import type { Flight, TripRequest } from "../src/lib/types.ts";

const req: TripRequest = { destinations: ["Lisbon"], origin: "Toronto", startDate: "2026-05-10", endDate: "2026-05-15", adults: 2, children: 0, budgetTier: "comfort", pace: "balanced", interests: ["food", "history"], stayType: "hotel" };
const flight = (f: Partial<Flight>): Flight => ({ id: Math.random().toString(36).slice(2), kind: "outbound", from: "YYZ", to: "LIS", departDate: "2026-05-10", departTime: "09:00", arriveDate: "2026-05-10", arriveTime: "11:00", ...f });

test("full days get ordered clock times with travel buffers and meals", () => {
  const trip = curateTrip(req);
  const day = trip.days[2];
  const items = scheduleDay(trip, day);
  const acts = items.filter((i) => i.kind === "activity");
  assert.equal(acts[0].start, 9 * 60, "balanced pace starts at 9:00");
  for (let i = 1; i < items.length; i++) assert.ok(items[i].start >= items[i - 1].end, `no overlaps: ${items[i - 1].label} → ${items[i].label}`);
  assert.ok(items.some((i) => i.label === "Lunch") || acts.some((a) => /tasting|food|market/i.test(a.label)));
  const evening = acts.find((a) => a.activity!.slot === "evening");
  if (evening) assert.ok(evening.start >= 18 * 60);
  assert.equal(clock(9 * 60), "9:00 a.m.");
});

test("pinned start times are honoured and overlaps flagged", () => {
  const trip = curateTrip(req);
  const day = structuredClone(trip.days[2]);
  day.activities[1].start = "09:30";
  const items = scheduleDay(trip, day);
  const pinned = items.find((i) => i.activity?.id === day.activities[1].id)!;
  assert.equal(pinned.start, toMinutes("09:30"));
  assert.ok(pinned.pinned && pinned.conflict, "starts before the first stop ends");
});

test("a late arrival shrinks the first day; anything that doesn't fit moves to Ideas", () => {
  const trip = { ...curateTrip(req), flights: [flight({ departTime: "10:00", arriveTime: "21:30" })] };
  const w = dayWindow(trip, trip.days[0]);
  assert.equal(w.start, 23 * 60, "21:30 landing + 90 min");
  const { trip: fitted, moved } = fitToFlights(trip);
  assert.ok(moved.length > 0);
  assert.ok(fitted.days[0].activities.every((a) => a.category === "transit"));
  assert.ok(fitted.parked!.every((p) => p.city === "Lisbon" && p.reason));
});

test("overnight outbound flight turns day one into a travel day", () => {
  const trip = { ...curateTrip(req), flights: [flight({ departTime: "21:00", arriveDate: "2026-05-11", arriveTime: "09:00" })] };
  const { trip: fitted } = fitToFlights(trip);
  assert.match(fitted.days[0].theme, /Travel to/);
  assert.ok(fitted.days[1].activities[0].category === "transit", "arrival placeholder moved to landing day");
  const day1 = dayWindow(fitted, fitted.days[1]);
  assert.equal(day1.start, 10 * 60 + 30);
});

test("return flight sets the last day's cut-off and warns on date mismatch", () => {
  const trip = { ...curateTrip(req), flights: [flight({ kind: "return", from: "LIS", to: "YYZ", departDate: "2026-05-15", departTime: "13:00", arriveDate: "2026-05-15", arriveTime: "16:00" })] };
  const w = dayWindow(trip, trip.days.at(-1)!);
  assert.equal(w.end, 10 * 60);
  const items = scheduleDay(trip, trip.days.at(-1)!);
  assert.ok(items.some((i) => i.kind === "flight" && i.start === 13 * 60));
  const off = { ...trip, flights: [{ ...trip.flights[0], departDate: "2026-05-16" }] };
  assert.ok(fitToFlights(off).warnings.some((x) => /return flight/.test(x)));
});

test("extracted confirmations become typed flights and attach stays", async () => {
  const { toFlights, applyStays, classifyFlight } = await import("../src/lib/bookings.ts");
  const trip = curateTrip(req);
  const flights = toFlights(trip, [
    { airline: "Air Canada", flightNumber: "AC1906", from: "YYZ", to: "LIS", departDate: "2026-05-09", departTime: "21:40", arriveDate: "2026-05-10", arriveTime: "9:55", confirmation: "ABC123" },
    { airline: "TAP", flightNumber: "TP259", from: "LIS", to: "Toronto", departDate: "2026-05-15", departTime: "12:30", arriveDate: "2026-05-15", arriveTime: "15:45", confirmation: "" },
    { airline: "", flightNumber: "", from: "", to: "LIS", departDate: "bad", departTime: "", arriveDate: "", arriveTime: "", confirmation: "" },
  ]);
  assert.deepEqual(flights.map((f) => f.kind), ["outbound", "return"]);
  assert.equal(flights[0].arriveTime, "09:55");
  assert.equal(classifyFlight(trip, "LIS", "OPO"), "between");
  const { trip: withStay, matched } = applyStays(trip, [{ name: "Memmo Alfama", address: "Tv. Merceeiras 27, Lisboa", city: "Lisbon", checkInDate: "2026-05-10", checkOutDate: "2026-05-15", checkInTime: "15:00", checkOutTime: "11:00", confirmation: "X9" }]);
  assert.equal(matched, 1);
  assert.equal(withStay.stays[0].booking?.name, "Memmo Alfama");
});

test("ideas exclude what's planned and put parked items first", async () => {
  const { ideasFor } = await import("../src/lib/ideas.ts");
  const trip = curateTrip(req);
  const planned = new Set(trip.days.flatMap((d) => d.activities.map((a) => a.ref)));
  const parked = { ...trip.days[2].activities[0], city: "Lisbon", reason: "test" };
  const ideas = ideasFor({ ...trip, parked: [parked] }, "Lisbon");
  assert.equal(ideas[0].origin, "parked");
  assert.ok(ideas.filter((i) => i.origin === "catalog").every((i) => !planned.has(i.ref) && i.id.startsWith("cat:")));
  assert.equal(new Set(ideas.map((i) => i.id)).size, ideas.length, "ids are unique");
});

test("drag-and-drop edits: park, add idea, reorder, cross-day and cross-city rules", async () => {
  const { parkActivity, insertIdea, moveStop } = await import("../src/lib/plan-edit.ts");
  const { ideasFor } = await import("../src/lib/ideas.ts");
  const multi = curateTrip({ ...req, destinations: ["Lisbon", "Paris"], endDate: "2026-05-16" });
  const d2 = multi.days[2];
  const target = d2.activities.find((a) => a.category !== "transit")!;

  const parked = parkActivity(multi, 2, target.id, "Removed by you");
  assert.ok(!parked.days[2].activities.some((a) => a.id === target.id));
  assert.equal(parked.parked!.at(-1)!.id, target.id);

  const idea = ideasFor(parked, "Lisbon").find((i) => i.origin === "parked")!;
  const back = insertIdea(parked, idea, 1).trip;
  assert.ok(back.days[1].activities.some((a) => a.title === target.title));
  assert.ok(!back.parked!.some((p) => p.id === idea.id), "parked idea leaves the list once used");

  const parisDay = multi.days.findIndex((d) => d.city === "Paris" && d.activities.length > 1);
  assert.ok(insertIdea(parked, idea, parisDay).error, "can't drop a Lisbon idea on a Paris day");

  const first = d2.activities[0];
  const reordered = moveStop(multi, 2, first.id, 2).trip.days[2].activities;
  assert.equal(reordered.at(-1)!.id, first.id);
  assert.deepEqual(reordered.map((a) => a.slot), d2.activities.map((a) => a.slot), "slot sequence stays chronological");

  const moved = moveStop(multi, 2, target.id, 1).trip;
  assert.ok(moved.days[1].activities.some((a) => a.id === target.id) && !moved.days[2].activities.some((a) => a.id === target.id));
});

test("evening experiences stay in the evening wherever they're dropped", async () => {
  const { insertIdea, moveStop } = await import("../src/lib/plan-edit.ts");
  const { ideasFor } = await import("../src/lib/ideas.ts");
  const trip = curateTrip({ ...req, pace: "relaxed" });
  const evening = ideasFor(trip, "Lisbon").find((i) => i.slot === "evening")!;
  const day = trip.days[2];
  const out = insertIdea(trip, evening, 2, day.activities[0].id).trip.days[2].activities;
  const placed = out.findIndex((a) => a.title === evening.title);
  assert.equal(out[placed].slot, "evening");
  assert.ok(out.slice(0, placed).every((a) => a.slot !== "evening" || a.category === "transit"), "after the daytime stops");
  const scheduled = (await import("../src/lib/schedule.ts")).scheduleDay(trip, { ...day, activities: out });
  assert.ok(scheduled.find((i) => i.activity?.title === evening.title)!.start >= 18 * 60);
  const withEvening = { ...trip, days: trip.days.map((d) => (d.index === 2 ? { ...d, activities: out } : d)) };
  const moved = moveStop(withEvening, 2, out[placed].id, 2, out[0].id).trip.days[2].activities;
  assert.equal(moved.find((a) => a.title === evening.title)!.slot, "evening");
});

test("lunch fits between a morning stop and evening plans", () => {
  const trip = curateTrip(req);
  const day = structuredClone(trip.days[2]);
  day.activities = [
    { ...day.activities[0], slot: "morning", durationHrs: 2, start: undefined },
    { id: "eve", title: "Rooftop drinks", description: "Sunset cocktails", category: "nightlife", slot: "evening", durationHrs: 2, estCost: 20 },
  ];
  const items = scheduleDay(trip, day);
  const lunch = items.find((i) => i.label === "Lunch");
  assert.ok(lunch && lunch.start >= 12 * 60 && lunch.start <= 13 * 60);
  assert.ok(items.find((i) => i.activity?.id === "eve")!.start >= 18 * 60);
});
