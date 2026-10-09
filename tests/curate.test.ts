import assert from "node:assert/strict";
import { test } from "node:test";
import { curateTrip, planLegs, suggestAlternatives } from "../src/lib/curate.ts";
import { flightLinks, stayLinks, tripBookingLinks } from "../src/lib/booking.ts";
import { tripToICS } from "../src/lib/export.ts";
import type { TripRequest } from "../src/lib/types.ts";

const base: TripRequest = {
  destinations: ["Lisbon"],
  origin: "New York",
  startDate: "2026-05-10",
  endDate: "2026-05-15",
  adults: 2,
  children: 0,
  budgetTier: "comfort",
  pace: "balanced",
  interests: ["food", "history"],
  stayType: "hotel",
};

test("builds one day per calendar date, arrival to departure", () => {
  const trip = curateTrip(base);
  assert.equal(trip.days.length, 6);
  assert.equal(trip.days[0].date, "2026-05-10");
  assert.equal(trip.days.at(-1)!.date, "2026-05-15");
  assert.match(trip.days[0].theme, /Arrive/);
  assert.match(trip.days.at(-1)!.theme, /Farewell/);
  assert.equal(trip.stays[0].nights, 5);
});

test("never repeats a catalog activity within a trip", () => {
  const trip = curateTrip({ ...base, pace: "packed", endDate: "2026-05-24" });
  const refs = trip.days.flatMap((d) => d.activities.map((a) => a.ref).filter(Boolean));
  assert.equal(new Set(refs).size, refs.length);
});

test("must-see items are placed and avoided items excluded", () => {
  const trip = curateTrip({ ...base, mustSee: "Sintra", avoid: "fado" });
  const titles = trip.days.flatMap((d) => d.activities.map((a) => a.title.toLowerCase()));
  assert.ok(titles.some((t) => t.includes("sintra")));
  assert.ok(!titles.some((t) => t.includes("fado")));
});

test("families avoid non kid-friendly picks", () => {
  const trip = curateTrip({ ...base, destinations: ["Tokyo"], children: 2, interests: ["nightlife"] });
  const refs = trip.days.flatMap((d) => d.activities.map((a) => a.ref));
  assert.ok(!refs.includes("golden-gai"));
});

test("splits nights across multi-city trips and adds transfer days", () => {
  const req = { ...base, destinations: ["Rome", "Barcelona", "Paris"], endDate: "2026-05-20" };
  const legs = planLegs(req);
  assert.deepEqual(legs.map((l) => l.nights), [4, 3, 3]);
  assert.equal(legs[1].checkIn, legs[0].checkOut);
  const trip = curateTrip(req);
  assert.equal(trip.days[4].city, "Barcelona");
  assert.equal(trip.days[4].activities[0].category, "transit");
  const links = tripBookingLinks(trip.request, trip.stays);
  assert.equal(links.flights.length, 2, "open-jaw: outbound and return");
});

test("unknown cities still get a full itinerary", () => {
  const trip = curateTrip({ ...base, destinations: ["Ljubljana"] });
  assert.equal(trip.title, "6 days in Ljubljana");
  assert.ok(trip.days.every((d) => d.activities.length > 0));
});

test("budget is positive and roughly consistent", () => {
  const trip = curateTrip(base);
  const b = trip.budget;
  assert.equal(b.total, b.flights + b.lodging + b.food + b.activities + b.localTransport);
  assert.ok(b.lodging > 0 && b.flights > 0);
  const noOrigin = curateTrip({ ...base, origin: "" });
  assert.equal(noOrigin.budget.flights, 0);
});

test("alternatives exclude activities already planned", () => {
  const trip = curateTrip({ ...base, endDate: "2026-05-13" });
  const planned = new Set(trip.days.flatMap((d) => d.activities.map((a) => a.ref)));
  const alts = suggestAlternatives(trip, 2, "afternoon");
  assert.ok(alts.length > 0);
  assert.ok(alts.every((a) => !planned.has(a.ref)));
});

test("booking links carry dates and party size", () => {
  const [google, expedia, sky, kayak] = flightLinks({ origin: "JFK", destination: "Lisbon", depart: "2026-05-10", ret: "2026-05-15", adults: 2, children: 1 });
  assert.match(google.url, /google\.com\/travel\/flights/);
  assert.match(decodeURIComponent(expedia.url), /from:JFK,to:LIS,departure:05\/10\/2026/);
  assert.match(sky.url, /\/jfk\/lis\/260510\/260515\//);
  assert.match(kayak.url, /JFK-LIS\/2026-05-10\/2026-05-15\/2adults\/children-11/);
  const [airbnb, booking] = stayLinks({ city: "Lisbon", checkIn: "2026-05-10", checkOut: "2026-05-15", adults: 2, children: 0 });
  assert.match(airbnb.url, /checkin=2026-05-10&checkout=2026-05-15&adults=2/);
  assert.match(booking.url, /group_adults=2/);
});

test("calendar export is valid-looking ICS", () => {
  const ics = tripToICS(curateTrip(base));
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, (ics.match(/END:VEVENT/g) ?? []).length);
});

test("share links round-trip a trip", async () => {
  const { encodeTrip, decodeTrip } = await import("../src/lib/export.ts");
  const trip = curateTrip({ ...base, destinations: ["Rome", "Paris"], endDate: "2026-05-20" });
  const encoded = await encodeTrip(trip);
  assert.ok(encoded.length < 12000, `share payload is ${encoded.length} chars`);
  const back = await decodeTrip(encoded);
  assert.equal(back?.title, trip.title);
  assert.equal(back?.days.length, trip.days.length);
  assert.equal(await decodeTrip("not-a-trip"), undefined);
});
