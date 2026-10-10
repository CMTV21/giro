import assert from "node:assert/strict";
import { test } from "node:test";
import { curateTrip } from "../src/lib/curate.ts";
import { applyStopEdit, cleanDraft, customStop, draftFrom, emptyDraft, placeBySlot } from "../src/lib/plan-edit.ts";
import { scheduleDay } from "../src/lib/schedule.ts";
import { TripSchema } from "../src/lib/trip-schema.ts";
import type { TripRequest } from "../src/lib/types.ts";

const req: TripRequest = {
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
  currency: "CAD",
};

test("drafts are bounded: name required, quarter-hour durations, cost converted to USD", () => {
  assert.deepEqual(cleanDraft({ ...emptyDraft(), title: "  " }, 1.37), { ok: false, error: "Give the stop a name." });
  const r = cleanDraft({ ...emptyDraft(), title: " Dinner with Ana ", durationHrs: 1.6, costLocal: 137, start: "19:30", note: " Table for 4, ref XK9 " }, 1.37);
  assert.ok(r.ok);
  assert.equal(r.fields.title, "Dinner with Ana");
  assert.equal(r.fields.durationHrs, 1.5);
  assert.equal(r.fields.estCost, 100, "C$137 at 1.37 per USD");
  assert.equal(r.fields.start, "19:30");
  assert.equal(r.fields.note, "Table for 4, ref XK9");
  const odd = cleanDraft({ ...emptyDraft(), title: "x", durationHrs: 99, costLocal: -5, start: "25:00" }, 1);
  assert.ok(odd.ok && odd.fields.durationHrs === 12 && odd.fields.estCost === 0 && odd.fields.start === undefined);
  assert.ok(cleanDraft({ ...emptyDraft(), title: "x", durationHrs: 0 }, 1).ok && (cleanDraft({ ...emptyDraft(), title: "x", durationHrs: 0 }, 1) as { fields: { durationHrs: number } }).fields.durationHrs === 0.25);
});

test("editing round-trips through the draft, and renaming makes a stop your own", () => {
  const trip = curateTrip(req);
  const a = trip.days[1].activities.find((x) => x.ref)!;
  const same = cleanDraft(draftFrom(a, trip.fx!.rate), trip.fx!.rate);
  assert.ok(same.ok);
  const kept = applyStopEdit(a, { ...same.fields, note: "Bring cash" });
  assert.equal(kept.ref, a.ref, "same name keeps the catalog link");
  assert.equal(kept.note, "Bring cash");
  const renamed = applyStopEdit(a, { ...same.fields, title: "Coffee with my cousin" });
  assert.equal(renamed.ref, undefined);
  assert.equal(renamed.custom, true);
  assert.equal(renamed.place, undefined, "old map pin dropped");
});

test("longer stops push the rest of the day later", () => {
  const trip = curateTrip(req);
  const day = trip.days[1];
  const [first, second] = day.activities;
  const before = scheduleDay(trip, day).filter((i) => i.activity);
  const longer = { ...day, activities: day.activities.map((x) => (x.id === first.id ? { ...x, durationHrs: x.durationHrs + 1 } : x)) };
  const after = scheduleDay(trip, longer).filter((i) => i.activity);
  const at = (items: typeof before, id: string) => items.find((i) => i.activity!.id === id)!;
  assert.equal(at(after, first.id).end - at(before, first.id).end, 60, "the edited stop runs an hour longer");
  assert.ok(at(after, second.id).start > at(before, second.id).start, "the next stop moves later");
  assert.ok(at(after, second.id).start >= at(after, first.id).end, "and never overlaps (slack before dinner is used first)");
});

test("own stops land in their time of day, never after the departure", () => {
  const trip = curateTrip(req);
  const last = trip.days.at(-1)!;
  assert.equal(last.activities.at(-1)!.category, "transit");
  const r = cleanDraft({ ...emptyDraft("evening"), title: "Farewell drinks" }, 1);
  assert.ok(r.ok);
  const placed = placeBySlot(last.activities, customStop(r.fields, "own1"));
  assert.equal(placed.at(-1)!.category, "transit", "departure stays last");
  const morning = cleanDraft({ ...emptyDraft("morning"), title: "Pastry run" }, 1);
  assert.ok(morning.ok);
  const day = trip.days[1].activities;
  const withMorning = placeBySlot(day, customStop(morning.fields, "own2"));
  assert.equal(withMorning.findIndex((x) => x.id === "own2"), day[0].category === "transit" ? 1 : 0);
});

test("saved trips accept notes and own stops", () => {
  const trip = curateTrip(req);
  const r = cleanDraft({ ...emptyDraft(), title: "Meet Ana", note: "Gate 3" }, 1);
  assert.ok(r.ok);
  const edited = { ...trip, days: trip.days.map((d, i) => (i === 1 ? { ...d, activities: placeBySlot(d.activities, customStop(r.fields, "own3")) } : d)) };
  assert.ok(TripSchema.safeParse(edited).success);
  const tooLong = { ...edited, days: edited.days.map((d, i) => (i === 1 ? { ...d, activities: d.activities.map((x) => ({ ...x, note: "x".repeat(501) })) } : d)) };
  assert.ok(!TripSchema.safeParse(tooLong).success, "notes are size-capped");
});

test("a blank trip keeps the structure and travel days but no picks", async () => {
  const { blankTrip } = await import("../src/lib/curate.ts");
  const { ideasFor } = await import("../src/lib/ideas.ts");
  const trip = blankTrip({ ...req, destinations: ["Lisbon", "Porto"], endDate: "2026-05-16" });
  assert.equal(trip.days.length, 7);
  assert.ok(trip.days.every((d) => d.activities.every((a) => a.category === "transit")));
  assert.equal(trip.days[0].activities[0].category, "transit", "arrival kept");
  assert.equal(trip.days.at(-1)!.activities.at(-1)!.category, "transit", "departure kept");
  assert.equal(trip.budget.activities, 0);
  assert.ok(trip.budget.lodging > 0 && trip.stays.length === 2 && trip.packing.length > 0);
  assert.ok(ideasFor(trip, "Lisbon").filter((i) => i.origin === "catalog").length >= 10, "Ideas has the whole catalog to drag in");
  assert.ok(TripSchema.safeParse(trip).success);
});
