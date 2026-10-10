import assert from "node:assert/strict";
import { test } from "node:test";
import { curateTrip } from "../src/lib/curate.ts";
import { addDays } from "../src/lib/dates.ts";
import { DESTINATIONS } from "../src/lib/destinations.ts";
import { allGuides, buildGuide, GUIDE_PLAN, guideDestination, guidePath, guideStart, monthsLabel, parseGuideParam } from "../src/lib/guides.ts";
import { TripSchema } from "../src/lib/trip-schema.ts";

test("one guide per city per length, with clean URLs", () => {
  const all = allGuides();
  for (const d of DESTINATIONS) for (const n of [3, 5]) assert.ok(all.some((g) => g.slug === d.slug && g.days === n), `${d.slug} has a ${n}-day guide`);
  assert.ok(all.length >= DESTINATIONS.length * 2 && all.length <= DESTINATIONS.length * 3);
  assert.equal(guidePath("lisbon", 5), "/guides/lisbon/5-days");
  assert.equal(parseGuideParam("5-days"), 5);
  assert.equal(parseGuideParam("4-days"), undefined, "only published lengths");
  assert.equal(parseGuideParam("5days"), undefined);
  assert.equal(guideDestination("nowhere"), undefined);
});

test("every published guide builds a valid, full plan with the right number of days and no repeats", () => {
  for (const { slug, days } of allGuides()) {
    const dest = guideDestination(slug)!;
    const trip = buildGuide(dest, days);
    assert.equal(trip.days.length, days, slug);
    assert.ok(TripSchema.safeParse(trip).success, slug);
    const refs = trip.days.flatMap((d) => d.activities.map((a) => a.ref).filter(Boolean));
    assert.equal(new Set(refs).size, refs.length, `${slug} ${days}: no repeated stops`);
    const real = trip.days.slice(1, -1).every((d) => d.activities.some((a) => a.category !== "transit" && a.category !== "free"));
    assert.ok(real, `${slug} ${days}: middle days have real stops`);
  }
});

test("Make this trip mine reproduces the guide's days", () => {
  const dest = guideDestination("lisbon")!;
  const guide = buildGuide(dest, 5);
  const start = guideStart(dest);
  const mine = curateTrip({ destinations: ["Lisbon"], origin: "", startDate: start, endDate: addDays(start, 4), ...GUIDE_PLAN, interests: ["culture", "food"], currency: "CAD" });
  assert.deepEqual(mine.days.map((d) => d.activities.map((a) => a.ref ?? a.title)), guide.days.map((d) => d.activities.map((a) => a.ref ?? a.title)));
});

test("best months read naturally", () => {
  assert.equal(monthsLabel([4, 5, 6, 9, 10]), "April to June, September and October");
  assert.equal(monthsLabel([12, 1, 2]), "December to February");
  assert.equal(monthsLabel([11, 12, 1, 2, 3, 6]), "June and November to March");
  assert.equal(monthsLabel([3]), "March");
});
