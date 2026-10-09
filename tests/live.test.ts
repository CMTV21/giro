import assert from "node:assert/strict";
import { test } from "node:test";
import { curateTrip } from "../src/lib/curate.ts";
import { exposure, lightestLaterDay, moveActivity, nowAndNext, rainRisks, slotAt } from "../src/lib/live.ts";
import { parseForecast } from "../src/lib/weather.ts";
import type { TripRequest } from "../src/lib/types.ts";

const req: TripRequest = { destinations: ["Lisbon"], origin: "", startDate: "2026-05-10", endDate: "2026-05-16", adults: 2, children: 0, budgetTier: "comfort", pace: "balanced", interests: [], stayType: "hotel" };

test("classifies indoor and outdoor plans", () => {
  assert.equal(exposure({ title: "Gulbenkian Museum", description: "Art collection", category: "art" }), "indoor");
  assert.equal(exposure({ title: "Cascais beaches", description: "Sandy coves", category: "relaxation" }), "outdoor");
  assert.equal(exposure({ title: "Sintra day trip", description: "Pena Palace and forests", category: "history" }), "outdoor");
});

test("slots and now/next follow the clock", () => {
  assert.equal(slotAt(7), "early");
  assert.equal(slotAt(10), "morning");
  assert.equal(slotAt(15), "afternoon");
  assert.equal(slotAt(20), "evening");
  const day = curateTrip(req).days[2];
  const { now, next } = nowAndNext(day, 10);
  assert.equal(now?.slot, "morning");
  assert.ok(next && next.slot !== "morning");
});

test("rain risks only flag outdoor plans in wet slots", () => {
  const day = curateTrip(req).days.find((d) => d.activities.some((a) => exposure(a) === "outdoor"))!;
  const wet = Object.fromEntries(Array.from({ length: 24 }, (_, h) => [h, 90]));
  const risks = rainRisks(day, wet);
  assert.ok(risks.length > 0 && risks.every((r) => exposure(r.activity) === "outdoor"));
  assert.equal(rainRisks(day, {}).length, 0);
});

test("running late moves a stop to the lightest later day", () => {
  const trip = curateTrip(req);
  const target = lightestLaterDay(trip, 1)!;
  assert.ok(target.index > 1 && target.index < trip.days.length - 1);
  const act = trip.days[1].activities.find((a) => a.category !== "transit")!;
  const moved = moveActivity(trip, 1, act.id, target.index);
  assert.ok(!moved.days[1].activities.some((a) => a.id === act.id));
  assert.ok(moved.days[target.index].activities.some((a) => a.id === act.id));
});

test("parses Open-Meteo forecasts", () => {
  const f = parseForecast({
    timezone: "Europe/Lisbon",
    daily: { time: ["2026-05-10"], weather_code: [61], temperature_2m_max: [21.4], temperature_2m_min: [14], precipitation_probability_max: [80] },
    hourly: { time: ["2026-05-10T09:00", "2026-05-10T15:00"], precipitation_probability: [20, 85] },
  });
  assert.equal(f?.days[0].rain, 80);
  assert.equal(f?.days[0].hourlyRain[15], 85);
  assert.equal(parseForecast({}), undefined);
});
