import assert from "node:assert/strict";
import { test } from "node:test";
import { curateTrip, recalcBudget } from "../src/lib/curate.ts";
import { parseFare, summarizeFares } from "../src/lib/fares.ts";
import { rescheduleTrip } from "../src/lib/reschedule.ts";
import type { TripRequest } from "../src/lib/types.ts";
import { findFares } from "../src/server/fares.ts";

const row = (depart: string, ret: string, price: number, extra: Record<string, unknown> = {}) => ({
  origin: "YTO", destination: "LIS", origin_airport: "YYZ", destination_airport: "LIS", price, airline: "TP", flight_number: "258",
  departure_at: `${depart}T21:35:00-04:00`, return_at: `${ret}T11:20:00+00:00`, transfers: 0, return_transfers: 0, duration: 1260,
  link: `/search/YTO${depart.slice(8, 10)}${depart.slice(5, 7)}LIS${ret.slice(8, 10)}${ret.slice(5, 7)}1?t=TP17`, ...extra,
});

test("fare rows: kept only when checkable; links stay on aviasales.com", () => {
  const f = parseFare(row("2026-11-10", "2026-11-15", 812.4))!;
  assert.deepEqual(f, { price: 812, airline: "TP", departDate: "2026-11-10", returnDate: "2026-11-15", transfers: 0, url: "https://www.aviasales.com/search/YTO1011LIS15111?t=TP17" });
  assert.equal(parseFare(row("2026-11-10", "2026-11-15", 812, { link: "//evil.example/x" }))!.url, undefined);
  assert.equal(parseFare(row("2026-11-10", "2026-11-15", 0)), undefined);
  assert.equal(parseFare({ price: 500 }), undefined);
});

test("exact-date fare, plus a cheaper same-length trip within 3 days", () => {
  const rows = [row("2026-11-10", "2026-11-15", 900), row("2026-11-10", "2026-11-15", 812), row("2026-11-09", "2026-11-14", 690), row("2026-11-02", "2026-11-07", 400), row("2026-11-11", "2026-11-18", 500)];
  const s = summarizeFares(rows, "2026-11-10", "2026-11-15", "CAD");
  assert.equal(s.exact?.price, 812);
  assert.equal(s.nearby?.departDate, "2026-11-09", "too-far and different-length trips ignored");
  const small = summarizeFares([row("2026-11-10", "2026-11-15", 812), row("2026-11-11", "2026-11-16", 790)], "2026-11-10", "2026-11-15", "CAD");
  assert.equal(small.nearby, undefined, "a 3% saving isn't worth suggesting");
});

const req: TripRequest = {
  destinations: ["Lisbon"], origin: "Toronto", startDate: "2026-11-10", endDate: "2026-11-15",
  adults: 2, children: 0, budgetTier: "comfort", pace: "balanced", interests: ["food"], stayType: "hotel",
};

test("a chosen fare drives the flight estimate; booked flights still win; new dates drop it", () => {
  const trip = curateTrip(req);
  const quoted = recalcBudget({ ...trip, fareQuote: { perAdultUSD: 500, seenAt: "2026-10-10", from: "YYZ", to: "LIS" } });
  assert.notEqual(quoted.budget.flights, trip.budget.flights);
  assert.equal(quoted.budget.flights % 10, 0);
  assert.ok(Math.abs(quoted.budget.flights - 1000) <= 200, `about 2 × 500 (tier multiplier aside): ${quoted.budget.flights}`);
  const booked = recalcBudget({ ...quoted, flights: [{ id: "f", kind: "outbound", from: "YYZ", to: "LIS", departDate: "2026-11-10", departTime: "21:00", arriveDate: "2026-11-11", arriveTime: "09:00", paid: { amount: 1700, currency: "USD", usd: 1700 } }] });
  assert.equal(booked.budget.flights, 1700);
  assert.equal(rescheduleTrip(quoted, "2026-11-12", "2026-11-17").trip.fareQuote, undefined);
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("fare lookup: token header, month query, caching, failures", async () => {
  delete process.env.TRAVELPAYOUTS_TOKEN;
  assert.equal(await findFares("YYZ", "LIS", "2026-11-10", "2026-11-15", "CAD", async () => { throw new Error("must not call"); }), undefined);
  process.env.TRAVELPAYOUTS_TOKEN = "tp-test";
  let calls = 0;
  const fake = async (url: string, init: RequestInit) => {
    calls++;
    const u = new URL(url);
    assert.equal(u.pathname, "/aviasales/v3/prices_for_dates");
    assert.equal(u.searchParams.get("departure_at"), "2026-11");
    assert.equal(u.searchParams.get("currency"), "cad");
    assert.equal(new Headers(init.headers).get("x-access-token"), "tp-test");
    return json({ success: true, data: [row("2026-11-10", "2026-11-15", 812)], currency: "cad" });
  };
  assert.equal((await findFares("YYZ", "LIS", "2026-11-10", "2026-11-15", "CAD", fake))?.exact?.price, 812);
  assert.equal((await findFares("YYZ", "LIS", "2026-11-10", "2026-11-15", "CAD", fake))?.exact?.price, 812);
  assert.equal(calls, 1);
  assert.equal(await findFares("YYZ", "FCO", "2026-11-10", "2026-11-15", "CAD", async () => json({}, 500)), undefined);
  delete process.env.TRAVELPAYOUTS_TOKEN;
});
