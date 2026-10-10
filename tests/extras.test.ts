import assert from "node:assert/strict";
import { test } from "node:test";
import { esimLink, reserveLink, transferLink } from "../src/lib/booking.ts";
import { hostAllowed } from "../src/lib/affiliates.ts";
import { eventCategory, parseEvents } from "../src/lib/events.ts";
import { delayMinutes, flightNumberKey, parseFlightStatus } from "../src/lib/flight-status.ts";
import { eventsFor } from "../src/server/events.ts";
import { flightStatus } from "../src/server/flight-status.ts";

test("partner links: trains, eSIMs, restaurant booking", () => {
  assert.equal(transferLink("Lisbon", "Porto")!.url, "https://www.omio.com/trains/lisbon/porto");
  assert.equal(transferLink("Kraków", "Praha")!.url, "https://www.omio.com/trains/krakow/praha");
  assert.equal(transferLink("Rome", "Rome"), undefined);
  assert.equal(esimLink("Türkiye")!.url, "https://www.airalo.com/turkey-esim");
  assert.equal(esimLink("Portugal")!.url, "https://www.airalo.com/portugal-esim");
  assert.equal(esimLink("Canada"), undefined, "home needs no eSIM");
  assert.match(reserveLink("Joe Beef", "Montréal", "Canada").url, /^https:\/\/www\.opentable\.com\/s\?term=Joe\+Beef/);
  assert.match(reserveLink("Cervejaria Ramiro", "Lisbon", "Portugal").url, /google\.com\/maps/);
  for (const host of ["www.omio.com", "www.airalo.com", "www.opentable.com", "www.ticketmaster.ca", "www.aviasales.com"]) assert.ok(hostAllowed(host), host);
});

const tm = (over: Record<string, unknown> = {}) => ({
  id: "G5v", name: "Coldplay", url: "https://www.ticketmaster.pt/event/G5v",
  dates: { start: { localDate: "2026-11-14", localTime: "20:30:00" }, status: { code: "onsale" } },
  classifications: [{ segment: { name: "Music" }, genre: { name: "Rock" } }],
  priceRanges: [{ min: 55, max: 180, currency: "EUR" }],
  _embedded: { venues: [{ name: "Estádio da Luz" }] },
  ...over,
});

test("events: parsed, cancelled and off-site links dropped, duplicates merged", () => {
  const list = parseEvents({ _embedded: { events: [tm(), tm({ id: "dup" }), tm({ id: "x", url: "https://evil.example/e" }), tm({ id: "c", name: "Gone", dates: { start: { localDate: "2026-11-15" }, status: { code: "cancelled" } } }), { name: "no id" }] } });
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], { id: "G5v", name: "Coldplay", date: "2026-11-14", time: "20:30", venue: "Estádio da Luz", segment: "Music", genre: "Rock", priceMin: 55, priceMax: 180, currency: "EUR", url: "https://www.ticketmaster.pt/event/G5v" });
  assert.equal(eventCategory({ segment: "Sports" }), "adventure");
  assert.equal(eventCategory({ segment: "Arts & Theatre", genre: "Theatre" }), "art");
  assert.equal(eventCategory({ segment: "Music" }), "nightlife");
  assert.deepEqual(parseEvents(null), []);
});

test("events lookup: key in query, city coordinates, cached", async () => {
  delete process.env.TICKETMASTER_API_KEY;
  assert.deepEqual(await eventsFor("Lisbon", "2026-11-10", "2026-11-15", async () => { throw new Error("must not call"); }), []);
  process.env.TICKETMASTER_API_KEY = "tm-test";
  let calls = 0;
  const fake = async (url: string) => {
    calls++;
    const u = new URL(url);
    assert.equal(u.searchParams.get("apikey"), "tm-test");
    assert.match(u.searchParams.get("latlong")!, /^38\.7\d+,-9\.1\d+$/);
    assert.equal(u.searchParams.get("startDateTime"), "2026-11-10T00:00:00Z");
    return new Response(JSON.stringify({ _embedded: { events: [tm(), tm({ id: "late", name: "After", dates: { start: { localDate: "2026-12-01" } } })] } }));
  };
  const events = await eventsFor("Lisbon", "2026-11-10", "2026-11-15", fake);
  assert.deepEqual(events.map((e) => e.name), ["Coldplay"], "outside the dates dropped");
  await eventsFor("Lisbon", "2026-11-10", "2026-11-15", fake);
  assert.equal(calls, 1);
  delete process.env.TICKETMASTER_API_KEY;
});

const adb = (over: Record<string, unknown> = {}) => [{
  number: "AC 1906", status: "Expected",
  departure: { airport: { iata: "YYZ" }, scheduledTime: { local: "2026-11-10 21:35-05:00" }, revisedTime: { local: "2026-11-10 22:55-05:00" }, terminal: "1", gate: "D41" },
  arrival: { airport: { iata: "LIS" }, scheduledTime: { local: "2026-11-11 09:40+00:00" }, predictedTime: { local: "2026-11-11 10:58+00:00" }, baggageBelt: "7" },
  ...over,
}];

test("flight status: delays, cancellations, midnight crossings", () => {
  const s = parseFlightStatus(adb())!;
  assert.equal(s.label, "Delayed 1 h 18 min");
  assert.equal(s.tone, "warn");
  assert.equal(s.departGate, "D41");
  assert.equal(s.arriveRevised, "10:58");
  assert.equal(s.arriveRevisedDate, "2026-11-11");
  assert.equal(parseFlightStatus(adb({ status: "Canceled" }))!.label, "Cancelled");
  assert.equal(parseFlightStatus(adb({ arrival: { scheduledTime: { local: "2026-11-11 09:40+00:00" } }, departure: {} }))!.label, "On time");
  assert.equal(delayMinutes({ date: "2026-11-10", time: "23:30" }, { date: "2026-11-11", time: "00:45" }), 75);
  assert.equal(flightNumberKey("ac 1906"), "AC1906");
  assert.equal(flightNumberKey("hello"), undefined);
  assert.equal(parseFlightStatus([]), undefined);
});

test("flight status lookup: RapidAPI headers, no-data answers, cached", async () => {
  delete process.env.AERODATABOX_API_KEY;
  assert.equal(await flightStatus("AC1906", "2026-11-10", async () => { throw new Error("must not call"); }), undefined);
  process.env.AERODATABOX_API_KEY = "adb-test";
  let calls = 0;
  const fake = async (url: string, init?: RequestInit) => {
    calls++;
    assert.equal(url, "https://aerodatabox.p.rapidapi.com/flights/number/AC1906/2026-11-10?withAircraftImage=false&withLocation=false");
    assert.equal(new Headers(init?.headers).get("x-rapidapi-key"), "adb-test");
    return new Response(JSON.stringify(adb()));
  };
  assert.equal((await flightStatus("AC1906", "2026-11-10", fake))?.label, "Delayed 1 h 18 min");
  await flightStatus("AC1906", "2026-11-10", fake);
  assert.equal(calls, 1);
  assert.equal(await flightStatus("XX1", "2026-11-10", async () => new Response(null, { status: 204 })), undefined);
  delete process.env.AERODATABOX_API_KEY;
});
