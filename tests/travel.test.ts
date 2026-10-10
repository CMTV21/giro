import assert from "node:assert/strict";
import { test } from "node:test";
import { curateTrip } from "../src/lib/curate.ts";
import { scheduleDay, travelLabel, travelMinutes } from "../src/lib/schedule.ts";
import { chainsOf, hopsOf, routable, withTravel } from "../src/lib/travel.ts";
import type { TripRequest } from "../src/lib/types.ts";
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
