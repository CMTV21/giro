import assert from "node:assert/strict";
import { test } from "node:test";
import { curateTrip, lodgingByLeg, planLegs, recalcBudget } from "../src/lib/curate.ts";
import { isPayCurrency, parseExtraRates } from "../src/lib/currency.ts";
import { rescheduleTrip } from "../src/lib/reschedule.ts";
import { TripSchema } from "../src/lib/trip-schema.ts";
import type { Trip, TripRequest } from "../src/lib/types.ts";

const req: TripRequest = { destinations: ["Rome", "Florence"], origin: "Toronto", startDate: "2026-05-10", endDate: "2026-05-16", adults: 2, children: 0, budgetTier: "comfort", pace: "balanced", interests: ["food"], stayType: "hotel", currency: "CAD" };
const flight = (paidUsd?: number): NonNullable<Trip["flights"]>[number] => ({ id: "f1", kind: "outbound", from: "YYZ", to: "FCO", departDate: "2026-05-09", departTime: "18:00", arriveDate: "2026-05-10", arriveTime: "08:00", ...(paidUsd ? { paid: { amount: paidUsd * 1.38, currency: "CAD" as const, usd: paidUsd } } : {}) });

test("no prices: the budget is the estimate, with no booked marker", () => {
  const trip = curateTrip(req);
  const again = recalcBudget(trip);
  assert.deepEqual(again.budget, trip.budget);
  assert.equal(again.budget.booked, undefined);
});

test("a paid flight replaces the flight estimate and the total follows", () => {
  const trip = curateTrip(req);
  const r = recalcBudget({ ...trip, flights: [flight(1234.56)] });
  assert.equal(r.budget.flights, 1234.56);
  assert.deepEqual(r.budget.booked, { flights: 1234.56 });
  const b = r.budget;
  assert.equal(Math.round((b.flights + b.lodging + b.food + b.activities + b.localTransport) * 100) / 100, b.total);
});

test("each paid stay replaces only its own city's lodging estimate", () => {
  const trip = curateTrip(req);
  const legs = planLegs(trip.request);
  const perLeg = lodgingByLeg(trip.request, legs);
  const r = recalcBudget({ ...trip, stays: trip.stays.map((s, i) => (i === 0 ? { ...s, booking: { name: "Hotel Roma", paid: { amount: 900, currency: "EUR", usd: 1020 } } } : s)) });
  assert.deepEqual(r.budget.booked, { lodging: 1020 });
  assert.equal(r.budget.lodging, Math.round((1020 + Math.round(perLeg[1] / 10) * 10) * 100) / 100, "paid Rome + estimated Florence");
  assert.notEqual(r.budget.lodging, trip.budget.lodging);
});

test("prices survive saving, rescheduling and junk is refused", () => {
  const trip = recalcBudget({ ...curateTrip(req), flights: [flight(800)] });
  assert.ok(TripSchema.safeParse(trip).success);
  assert.ok(!TripSchema.safeParse({ ...trip, flights: [{ ...flight(800), paid: { amount: 5, currency: "XYZ", usd: 5 } }] }).success, "unknown currency rejected");
  const moved = rescheduleTrip(trip, "2026-06-10", "2026-06-16");
  assert.equal(moved.trip.budget.flights, 800, "booked flights stay booked when dates move");
});

test("payment currencies: display ones plus ECB extras, extras only from live rates", () => {
  assert.ok(isPayCurrency("CZK") && isPayCurrency("THB") && isPayCurrency("CAD"));
  assert.ok(!isPayCurrency("MAD"), "not on the ECB feed");
  assert.deepEqual(parseExtraRates({ rates: { CZK: 22.8, CAD: 1.38, THB: -1, KRW: "x" } }), { CZK: 22.8 });
  assert.deepEqual(parseExtraRates(undefined), {});
});
