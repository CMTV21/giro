import assert from "node:assert/strict";
import { test } from "node:test";
import { curateTrip } from "../src/lib/curate.ts";
import { tripToICS } from "../src/lib/export.ts";
import { addPackingItem, packingItems, removePackingItem, restoreSuggestions } from "../src/lib/packing.ts";
import { TripSchema } from "../src/lib/trip-schema.ts";
import type { TripRequest } from "../src/lib/types.ts";

const req: TripRequest = { destinations: ["Lisbon"], origin: "", startDate: "2026-05-10", endDate: "2026-05-13", adults: 2, children: 0, budgetTier: "comfort", pace: "balanced", interests: ["food"], stayType: "hotel" };

test("add, dedupe, remove and restore packing items", () => {
  const trip = curateTrip(req);
  const n = trip.packing.length;
  const a = addPackingItem(trip, "  Snorkel   mask ").trip;
  assert.deepEqual(a.packingAdded, ["Snorkel mask"]);
  assert.equal(packingItems(a).length, n + 1);
  assert.ok(packingItems(a).at(-1)!.added);
  assert.match(addPackingItem(a, "snorkel MASK").error!, /already/);
  assert.match(addPackingItem(a, trip.packing[0].toUpperCase()).error!, /already/, "suggestions count too");
  assert.equal(addPackingItem(a, "   ").trip, a, "blank is ignored");

  const removedOwn = removePackingItem(a, "snorkel mask");
  assert.deepEqual(removedOwn.packingAdded, []);
  const removedSuggested = removePackingItem(a, trip.packing[0]);
  assert.ok(!packingItems(removedSuggested).some((p) => p.item === trip.packing[0]));
  assert.deepEqual(addPackingItem(removedSuggested, trip.packing[0]).trip.packingRemoved, [], "re-adding a removed suggestion restores it");
  assert.equal(packingItems(restoreSuggestions(removedSuggested)).length, n + 1);
});

test("trip notes and stop notes are saved, capped and exported", () => {
  const trip = curateTrip(req);
  const withNotes = { ...trip, notes: "Insurance: policy 123", days: trip.days.map((d, i) => (i === 1 ? { ...d, activities: d.activities.map((x, k) => (k === 0 ? { ...x, note: "Meet at 9 by the fountain" } : x)) } : d)) };
  assert.ok(TripSchema.safeParse(withNotes).success);
  assert.ok(!TripSchema.safeParse({ ...withNotes, notes: "x".repeat(5001) }).success);
  assert.ok(!TripSchema.safeParse({ ...withNotes, packingAdded: Array.from({ length: 61 }, (_, i) => `item ${i}`) }).success);
  assert.match(tripToICS(withNotes).replace(/\r\n /g, ""), /Note: Meet at 9 by the fountain/);
});
