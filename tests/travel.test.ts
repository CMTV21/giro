import assert from "node:assert/strict";
import { test } from "node:test";
import { curateTrip } from "../src/lib/curate.ts";
import { scheduleDay, travelLabel, travelMinutes } from "../src/lib/schedule.ts";
import { cityTransit, distanceKm, estimateLeg, hopAdvice } from "../src/lib/getting-around.ts";
import { chainsOf, hopsOf, routable, withTravel } from "../src/lib/travel.ts";
import type { Activity, TripRequest } from "../src/lib/types.ts";
import { getDb } from "../src/server/db.ts";
import { lookupHours } from "../src/server/hours.ts";
import { MAX_WALK_MINUTES, RIDE_BUFFER_MINUTES, routeLegs } from "../src/server/routing.ts";

const req: TripRequest = {
  destinations: ["Lisbon"], origin: "", startDate: "2026-05-10", endDate: "2026-05-13",
  adults: 2, children: 0, budgetTier: "comfort", pace: "balanced", interests: ["food"], stayType: "hotel",
};

test("hops follow the scheduler's order; chains split where the run breaks", () => {
  const trip = curateTrip(req);
  const day = trip.days[1];
  const hops = hopsOf(trip, day);
  assert.equal(hops.length, day.activities.length - 1);
  assert.equal(hops[0].from.id, day.activities[0].id);
  const routed = hops.filter((h) => routable(h.from) && routable(h.to));
  const chains = chainsOf(routed);
  assert.equal(chains.flat().length, routed.length);
  for (const c of chains) for (let i = 1; i < c.length; i++) assert.equal(c[i].from.id, c[i - 1].to.id);
  assert.equal(chainsOf(routed, 1).length, routed.length, "max length respected");
});

test("measured travel replaces the guess, and only for the same previous stop", () => {
  const trip = curateTrip(req);
  const day = trip.days[1];
  const [a, b] = day.activities;
  const guess = travelMinutes(a, b);
  const next = withTravel(trip, new Map([[b.id, { from: a.id, mins: 8, mode: "walk" as const }]]));
  const b2 = next.days[1].activities[1];
  assert.equal(travelMinutes(a, b2), 13, "8 min walk + 5 min slack");
  assert.equal(travelLabel(a, b2), "~8 min walk");
  assert.equal(travelMinutes({ ...a, id: "other" }, b2), guess === 13 ? 20 : guess, "ignored after reordering");
  assert.equal(withTravel(next, new Map([[b.id, { from: a.id, mins: 9, mode: "walk" as const }]])), next, "tiny changes don't re-save");
  const before = scheduleDay(trip, trip.days[1]).find((i) => i.activity?.id === b.id)!.start;
  const after = scheduleDay(next, next.days[1]).find((i) => i.activity?.id === b.id)!.start;
  assert.ok(after <= before, "a short walk never starts the next stop later");
  const ride = withTravel(trip, new Map([[b.id, { from: a.id, mins: 25, mode: "ride" as const }]]));
  assert.equal(travelLabel(a, ride.days[1].activities[1]), "~25 min by taxi or transit");
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("opening hours: looked up once, cached, and safe without a key", async () => {
  delete process.env.GOOGLE_PLACES_API_KEY;
  assert.deepEqual(await lookupHours("Torre de Belém", "Lisbon", async () => { throw new Error("must not call"); }), { hours: undefined });
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  let calls = 0;
  let sentKey = "";
  const fake = async (_url: string, init: RequestInit) => {
    calls++;
    sentKey = new Headers(init.headers).get("x-goog-api-key") ?? "";
    return json({ places: [{ businessStatus: "OPERATIONAL", googleMapsUri: "https://maps.google.com/?cid=1", regularOpeningHours: { periods: [{ open: { day: 2, hour: 10, minute: 0 }, close: { day: 2, hour: 17, minute: 30 } }] } }] });
  };
  const first = await lookupHours("Torre de Belém", "Lisbon", fake);
  assert.equal(first.hours?.periods.length, 1);
  assert.equal(first.mapsUrl, "https://maps.google.com/?cid=1");
  assert.equal(sentKey, "test-key");
  const again = await lookupHours("Torre de Belem", "lisbon", fake);
  assert.equal(calls, 1, "accent and case variants hit the cache");
  assert.deepEqual(again.hours, first.hours);
  const failing = await lookupHours("Nowhere Museum", "Lisbon", async () => json({}, 500));
  assert.equal(failing.hours, undefined, "provider errors don't break anything");
  delete process.env.GOOGLE_PLACES_API_KEY;
});

test("opening hours: a monthly cap stops paid lookups", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  process.env.GOOGLE_PLACES_MONTHLY_CAP = "2";
  await (await getDb()).query("delete from api_usage");
  let calls = 0;
  const fake = async () => {
    calls++;
    return json({ places: [] });
  };
  for (const name of ["Cap Museum A", "Cap Museum B", "Cap Museum C", "Cap Museum D"]) await lookupHours(name, "Porto", fake);
  assert.equal(calls, 2, "no calls past the cap");
  assert.deepEqual(await lookupHours("Cap Museum E", "Porto", fake), { hours: undefined, mapsUrl: undefined });
  process.env.GOOGLE_PLACES_MONTHLY_CAP = "0";
  await lookupHours("Cap Museum F", "Porto", fake);
  assert.equal(calls, 2, "a cap of 0 switches lookups off");
  delete process.env.GOOGLE_PLACES_MONTHLY_CAP;
  delete process.env.GOOGLE_PLACES_API_KEY;
});

test("routing: walks short hops, rides long ones, caches pairs", async () => {
  delete process.env.STADIA_API_KEY;
  const pts = [{ lat: 38.7139, lon: -9.1334 }, { lat: 38.7110, lon: -9.1360 }, { lat: 38.6916, lon: -9.2160 }];
  assert.deepEqual(await routeLegs(pts, async () => { throw new Error("must not call"); }), [undefined, undefined]);
  process.env.STADIA_API_KEY = "stadia-test";
  const bodies: { costing: string; locations: unknown[] }[] = [];
  const fake = async (url: string, init: RequestInit) => {
    assert.match(url, /api_key=stadia-test/);
    const body = JSON.parse(String(init.body));
    bodies.push(body);
    if (body.costing === "pedestrian") return json({ trip: { legs: [{ summary: { time: 9 * 60, length: 0.6 } }, { summary: { time: 95 * 60, length: 7.4 } }] } });
    return json({ trip: { legs: [{ summary: { time: 14 * 60, length: 8.1 } }] } });
  };
  const legs = await routeLegs(pts, fake);
  assert.deepEqual(legs[0], { minutes: 9, km: 0.6, mode: "walk" });
  assert.deepEqual(legs[1], { minutes: 14 + RIDE_BUFFER_MINUTES, km: 8.1, mode: "ride" });
  assert.ok(95 > MAX_WALK_MINUTES);
  assert.deepEqual(bodies.map((b) => b.costing), ["pedestrian", "auto"]);
  const n = bodies.length;
  assert.deepEqual(await routeLegs(pts, fake), legs, "second time from cache");
  assert.equal(bodies.length, n);
  assert.deepEqual(await routeLegs([{ lat: 999, lon: 0 }, pts[0]], fake), [], "bad points rejected");
  delete process.env.STADIA_API_KEY;
});

const stop = (id: string, extra: Partial<Activity> = {}): Activity => ({ id, title: `Stop ${id}`, description: "", category: "culture", slot: "morning", durationHrs: 1, estCost: 0, ...extra });

test("getting around: estimates from distance walk short hops and ride long ones", () => {
  const baixa = { lat: 38.7107, lon: -9.1366 };
  const chiado = { lat: 38.7105, lon: -9.1425 };
  const belem = { lat: 38.6916, lon: -9.2160 };
  assert.ok(Math.abs(distanceKm(baixa, belem) - 7.2) < 0.3);
  const near = estimateLeg(baixa, chiado);
  assert.equal(near.mode, "walk");
  assert.ok(near.mins >= 5 && near.mins <= 12, `walk ${near.mins}`);
  const far = estimateLeg(baixa, belem);
  assert.equal(far.mode, "ride");
  assert.ok(far.km > 9 && far.km < 10);
});

test("getting around: picks walk, the city's transit, or a taxi", () => {
  const a = stop("a");
  const walk = hopAdvice(a, stop("b", { travel: { from: "a", mins: 9, mode: "walk", km: 0.7 } }), "Lisbon");
  assert.deepEqual([walk.mode, walk.label, walk.alt, walk.estimated], ["walk", "~9 min walk", undefined, false]);
  assert.match(walk.directionsUrl, /travelmode=walking/);

  const longWalk = hopAdvice(a, stop("b", { travel: { from: "a", mins: 28, mode: "walk", km: 2.2 } }), "Paris");
  assert.equal(longWalk.mode, "walk");
  assert.match(longWalk.alt ?? "", /^or ~\d+ min by (Métro|taxi)$/);

  const ride = { travel: { from: "a", mins: 25, mode: "ride" as const, km: 7, est: true } };
  const paris = hopAdvice(a, stop("b", ride), "Paris", 14 * 60);
  assert.deepEqual([paris.mode, paris.estimated], ["transit", true]);
  assert.match(paris.label, /by Métro$/);
  assert.match(paris.directionsUrl, /travelmode=transit/);
  assert.match(hopAdvice(a, stop("b", ride), "Bali").label, /^~25 min by Grab/);
  assert.equal(hopAdvice(a, stop("b", ride), "Paris", 23 * 60 + 30).mode, "taxi", "late at night, take a car");
  const dayTrip = hopAdvice(a, stop("b", { travel: { from: "a", mins: 76, mode: "ride", km: 24.8, est: true } }), "Paris", 15 * 60);
  assert.deepEqual([dayTrip.mode, dayTrip.label, dayTrip.alt], ["transit", "~60 min by Métro", undefined], "long hops ride faster lines");
  assert.equal(cityTransit("Reykjavík").transit, undefined, "accents still match the city");
  assert.equal(cityTransit("Montréal").transit, "Métro");
  assert.equal(cityTransit("Somewhere New").transit, "public transport");
});

test("getting around: without a leg, the neighbourhood decides; stale legs are ignored", () => {
  const same = hopAdvice(stop("a", { area: "Alfama" }), stop("b", { area: "Alfama" }), "Lisbon");
  assert.deepEqual([same.mode, same.label, same.estimated], ["walk", "~15 min walk", true]);
  const across = hopAdvice(stop("a", { area: "Alfama" }), stop("b", { area: "Belém" }), "Lisbon");
  assert.equal(across.mode, "transit");
  const stale = hopAdvice(stop("a"), stop("b", { travel: { from: "x", mins: 3, mode: "walk" } }), "Marrakech");
  assert.equal(stale.mode, "taxi", "a leg from a different previous stop doesn't count");
  assert.match(stale.directionsUrl, /origin=Stop\+a%2C\+Marrakech/);
});

test("getting around: a measured leg replaces an estimate of the same length", () => {
  const trip = curateTrip(req);
  const target = trip.days[1].activities[1];
  const from = trip.days[1].activities[0].id;
  const est = withTravel(trip, new Map([[target.id, { from, mins: 12, mode: "walk" as const, km: 1, est: true }]]));
  assert.notEqual(est, trip);
  const measured = withTravel(est, new Map([[target.id, { from, mins: 12, mode: "walk" as const, km: 1 }]]));
  assert.notEqual(measured, est, "the estimate flag alone is a change worth saving");
  assert.equal(measured.days[1].activities[1].travel?.est, undefined);
});
