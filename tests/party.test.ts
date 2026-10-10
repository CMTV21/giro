import assert from "node:assert/strict";
import { test } from "node:test";
import { flightLinks, stayLinks } from "../src/lib/booking.ts";
import { curateTrip, estimateBudget, planLegs, normalizeRequest, packingList, scoreActivity } from "../src/lib/curate.ts";
import { findDestination } from "../src/lib/destinations.ts";
import { childAges, describeParty, normalizeChildAges, partyMix } from "../src/lib/party.ts";
import type { TripRequest } from "../src/lib/types.ts";

const base: TripRequest = {
  destinations: ["Lisbon"],
  origin: "Toronto",
  startDate: "2026-05-10",
  endDate: "2026-05-15",
  adults: 2,
  children: 2,
  budgetTier: "comfort",
  pace: "balanced",
  interests: ["food", "history"],
  stayType: "hotel",
};

test("child ages are clamped, trimmed to the count and defaulted when missing", () => {
  assert.deepEqual(normalizeChildAges(2, [4, 30, 9]), [4, 17]);
  assert.equal(normalizeChildAges(0, [4]), undefined);
  assert.equal(normalizeChildAges(2, ["x", null]), undefined);
  assert.deepEqual(childAges({ children: 3, childAges: [1] }), [1, 8, 8]);
  assert.deepEqual(partyMix({ children: 3, childAges: [1, 7, 15] }), { infants: 1, kids: 1, teens: 1, youngest: 1 });
  assert.equal(describeParty({ adults: 2, children: 2, childAges: [0, 9] }), "2 adults and 2 children (under 1, 9)");
  assert.equal(describeParty({ adults: 1, children: 1 }), "1 adult and 1 child", "no invented ages");
  assert.deepEqual(normalizeRequest({ ...base, childAges: [3.6, -2, 12] }).childAges, [4, 0]);
});

test("partner links carry each child's real age", () => {
  const q = { adults: 2, children: 2, childAges: [1, 9] };
  const [, expedia, sky, kayak] = flightLinks({ ...q, origin: "YYZ", destination: "Lisbon", depart: "2026-05-10", ret: "2026-05-15" });
  assert.match(decodeURIComponent(expedia.url), /passengers=adults:2,children:2\[1;9\]/);
  assert.match(decodeURIComponent(sky.url), /childrenv2=1\|9/);
  assert.match(kayak.url, /\/2adults\/children-1L-9\?/);
  const [airbnb, booking, expediaStay, vrbo] = stayLinks({ ...q, children: 3, childAges: [1, 9, 15], city: "Lisbon", checkIn: "2026-05-10", checkOut: "2026-05-15" });
  assert.match(airbnb.url, /adults=3&children=1&infants=1/, "Airbnb counts teens as adults");
  assert.match(booking.url, /group_children=3&age=1&age=9&age=15/);
  assert.match(decodeURIComponent(expediaStay.url), /children=1_1,1_9,1_15/);
  assert.match(decodeURIComponent(vrbo.url), /children=1_1,1_9,1_15/);
});

test("a trip without ages is planned and priced exactly as before", () => {
  const legs = planLegs(base);
  const days = curateTrip(base).days;
  assert.deepEqual(estimateBudget(base, legs, days), estimateBudget({ ...base, childAges: [8, 8] }, legs, days));
});

test("infants and teens are priced differently from school-age kids", () => {
  const legs = planLegs(base);
  const days = curateTrip(base).days;
  const school = estimateBudget({ ...base, childAges: [8, 8] }, legs, days);
  const babies = estimateBudget({ ...base, childAges: [0, 1] }, legs, days);
  const teens = estimateBudget({ ...base, childAges: [14, 16] }, legs, days);
  assert.ok(babies.flights < school.flights && school.flights < teens.flights);
  assert.ok(babies.food < school.food && school.food < teens.food);
});

test("teens unlock adult picks; toddlers steer away from long days", () => {
  const lisbon = findDestination("Lisbon")!;
  const notForKids = lisbon.activities.find((a) => !a.kids && !a.cats.includes("nightlife"));
  assert.ok(notForKids, "catalog has an adult-leaning daytime stop");
  const ctx = (childAges: number[]) => ({ req: { ...base, childAges }, must: [], avoid: [], catalogSize: lisbon.activities.length });
  const idx = lisbon.activities.indexOf(notForKids!);
  assert.ok(scoreActivity(notForKids!, idx, ctx([14, 16])) > scoreActivity(notForKids!, idx, ctx([5, 7])));
  const nightlife = lisbon.activities.find((a) => a.cats.includes("nightlife") && !a.kids);
  assert.ok(nightlife);
  assert.equal(scoreActivity(nightlife!, 0, ctx([16, 17])), -Infinity, "no bars with minors, even teens");
  const long = lisbon.activities.find((a) => a.kids && a.hrs >= 6 && a.hrs < 9);
  assert.ok(long);
  assert.ok(scoreActivity(long!, 0, ctx([2, 3])) < scoreActivity(long!, 0, ctx([8, 9])));
});

test("packing adapts to toddlers", () => {
  const legs = planLegs(base);
  assert.ok(packingList({ ...base, childAges: [2, 6] }, legs).some((i) => /stroller/i.test(i)));
  assert.ok(!packingList({ ...base, childAges: [9, 12] }, legs).some((i) => /stroller/i.test(i)));
});
