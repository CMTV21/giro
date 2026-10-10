import assert from "node:assert/strict";
import { test } from "node:test";
import { accessCaution, accessPenalty, effortOf } from "../src/lib/access.ts";
import { curateTrip, genericDestination } from "../src/lib/curate.ts";
import { DESTINATIONS, findDestination } from "../src/lib/destinations.ts";
import type { TripRequest } from "../src/lib/types.ts";

const base: TripRequest = {
  destinations: ["Lisbon"],
  origin: "",
  startDate: "2026-05-10",
  endDate: "2026-05-16",
  adults: 2,
  children: 0,
  budgetTier: "comfort",
  pace: "balanced",
  interests: ["culture", "history", "adventure"],
  stayType: "hotel",
};

test("every hand rating points at a real catalog stop", async () => {
  const src = await import("node:fs").then((fs) => fs.readFileSync(new URL("../src/lib/access.ts", import.meta.url), "utf8"));
  const block = src.slice(src.indexOf("const RATINGS"), src.indexOf("};", src.indexOf("const RATINGS")));
  const rated = [...block.matchAll(/"?([a-z0-9-]+)"?:\s*"[EMS]r?a?"/g)].map((m) => m[1]);
  const known = new Set(DESTINATIONS.flatMap((d) => d.activities.map((a) => a.key)));
  const generic = genericDestination("Nowhere").activities.map((a) => a.key);
  for (const suffix of ["walking-tour", "food-tour", "day-trip", "bike"]) assert.ok(generic.includes(`nowhere-${suffix}`), suffix);
  assert.ok(rated.length > 150, `parsed ${rated.length} ratings`);
  assert.deepEqual(rated.filter((k) => !known.has(k)), []);
});

test("ratings decode, and unrated long outings count as moderate", () => {
  assert.deepEqual(effortOf({ key: "stpeters", hrs: 2 }), { level: "strenuous", rough: true, active: false, rated: true });
  assert.deepEqual(effortOf({ key: "surf", hrs: 3 }), { level: "strenuous", rough: true, active: true, rated: true });
  assert.equal(effortOf({ key: "eiffel", hrs: 2.5 }).level, "easy", "lifts to the top");
  assert.equal(effortOf({ key: "unknown", hrs: 7 }).level, "moderate");
  assert.equal(effortOf({ key: "unknown", hrs: 2 }).level, "easy");
  assert.deepEqual(effortOf({ key: "porto-bike", hrs: 3 }), { level: "moderate", rough: false, active: true, rated: true }, "generic stops rated by suffix");
});

test("needs rule stops out or down", () => {
  const climb = effortOf({ key: "stpeters", hrs: 2 });
  const cobbles = effortOf({ key: "alfama", hrs: 3.5 });
  const museum = effortOf({ key: "gulbenkian", hrs: 2.5 });
  assert.equal(accessPenalty(climb, ["low-walking"]), -Infinity);
  assert.equal(accessPenalty(cobbles, ["step-free"]), -Infinity);
  assert.equal(accessPenalty(cobbles, ["low-walking"]), -3, "walkable, just tiring");
  assert.equal(accessPenalty(museum, ["step-free", "stroller"]), 0);
  assert.equal(accessPenalty(climb, undefined), 0);
  assert.equal(accessCaution(cobbles, ["stroller"]), "Stairs or uneven ground");
  assert.equal(accessCaution(museum, ["stroller"]), undefined);
});

test("a step-free Lisbon trip skips hills and surf but still fills its days", () => {
  const trip = curateTrip({ ...base, access: ["step-free"] });
  const refs = trip.days.flatMap((d) => d.activities.map((a) => a.ref));
  for (const bad of ["alfama", "surf", "sintra", "bairro-alto", "miradouro"]) assert.ok(!refs.includes(bad), bad);
  const fullDays = trip.days.slice(1, -1);
  assert.ok(fullDays.every((d) => d.activities.length >= 2), "no near-empty days");
  const open = curateTrip(base).days.flatMap((d) => d.activities.map((a) => a.ref));
  assert.ok(open.includes("alfama") || open.includes("surf"), "without needs, those stops are eligible");
});

test("access needs survive normalisation and junk is dropped", () => {
  const trip = curateTrip({ ...base, access: ["stroller", "stroller", "jetpack" as never] });
  assert.deepEqual(trip.request.access, ["stroller"]);
  assert.ok(findDestination("Lisbon"));
});
