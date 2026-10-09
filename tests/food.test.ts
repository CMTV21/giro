import assert from "node:assert/strict";
import { test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { hostAllowed } from "../src/lib/affiliates.ts";
import { curateWithClaude } from "../src/lib/ai.ts";
import { reviewsLink, topRestaurantsLink } from "../src/lib/booking.ts";
import { curateTrip } from "../src/lib/curate.ts";
import { FOOD } from "../src/data/food.ts";
import { DESTINATIONS } from "../src/lib/destinations.ts";
import { foodFor, restaurantRef, restaurantToActivity } from "../src/lib/food.ts";
import { addActivity } from "../src/lib/plan-edit.ts";
import { scheduleDay } from "../src/lib/schedule.ts";
import { parseTrip } from "../src/lib/trip-schema.ts";
import type { TripRequest } from "../src/lib/types.ts";

const req: TripRequest = { destinations: ["Lisbon"], origin: "Toronto", startDate: "2026-05-10", endDate: "2026-05-15", adults: 2, children: 0, budgetTier: "comfort", pace: "balanced", interests: ["food", "history"], stayType: "hotel", currency: "CAD" };

test("every catalog city has a complete food guide", () => {
  for (const d of DESTINATIONS) {
    const f = FOOD[d.slug];
    assert.ok(f, `${d.name} has a food guide`);
    assert.ok(f.dishes.length >= 5, `${d.name}: at least 5 dishes`);
    assert.ok(f.restaurants.length >= 6, `${d.name}: at least 6 restaurants`);
    assert.equal(new Set(f.restaurants.map((r) => r.name)).size, f.restaurants.length, `${d.name}: unique restaurants`);
    assert.equal(new Set(f.dishes.map((x) => x.name)).size, f.dishes.length, `${d.name}: unique dishes`);
    for (const r of f.restaurants) {
      assert.ok([1, 2, 3, 4].includes(r.price), `${r.name} price`);
      assert.ok(r.why.length > 20 && r.why.length <= 200, `${r.name} description length`);
      assert.ok(typeof r.book === "boolean", `${r.name} book flag`);
    }
    assert.ok(new Set(f.restaurants.map((r) => r.meal)).size >= 2, `${d.name}: more than one kind of meal`);
    assert.ok(f.restaurants.some((r) => r.price <= 2), `${d.name}: something affordable`);
  }
  assert.deepEqual(Object.keys(FOOD).filter((k) => !DESTINATIONS.some((d) => d.slug === k)), [], "no orphaned food guides");
});

test("foodFor prefers the curated guide, then Giro AI's, then nothing", () => {
  assert.equal(foodFor({}, "lisboa").source, "giro");
  assert.ok(foodFor({}, "Lisbon").restaurants.some((r) => r.name === "Pastéis de Belém"));
  const ai = foodFor({ food: [{ city: "Porto", dishes: [{ name: "Francesinha", what: "A meaty sandwich under melted cheese." }], restaurants: [] }] }, "porto");
  assert.equal(ai.source, "ai");
  assert.equal(ai.dishes[0].name, "Francesinha");
  assert.deepEqual(foodFor({}, "Ljubljana").restaurants, []);
});

test("restaurants slot into the right meal, and the scheduler doesn't double up", () => {
  const trip = curateTrip(req);
  const day = trip.days[2];
  const food = foodFor(trip, "Lisbon");
  const lunch = food.restaurants.find((r) => r.meal === "lunch")!;
  const dinner = food.restaurants.find((r) => r.meal === "dinner")!;
  const breakfast = food.restaurants.find((r) => r.meal === "breakfast")!;
  let t = addActivity(trip, 2, restaurantToActivity(lunch, "Lisbon", "l1"));
  t = addActivity(t, 2, restaurantToActivity(dinner, "Lisbon", "d1"));
  t = addActivity(t, 2, restaurantToActivity(breakfast, "Lisbon", "b1"));
  const acts = t.days[2].activities;
  assert.equal(acts.length, day.activities.length + 3);
  assert.equal(acts[0].id, "b1", "breakfast first");
  const order = acts.map((a) => ({ morning: 0, afternoon: 1, evening: 2 })[a.slot]);
  assert.deepEqual(order, [...order].sort(), "slots stay in time order");
  assert.equal(acts.find((a) => a.id === "l1")!.slot, "afternoon");
  assert.equal(acts.find((a) => a.id === "d1")!.slot, "evening");

  const items = scheduleDay(t, t.days[2]);
  const meals = items.filter((i) => i.kind === "meal").map((i) => i.label);
  assert.deepEqual(meals, [], "the restaurants replace the generic lunch and dinner");
  const l = items.find((i) => i.activity?.id === "l1")!;
  assert.ok(l.start >= 12 * 60 && l.start <= 15 * 60, "lunch at lunchtime");
  const dn = items.find((i) => i.activity?.id === "d1")!;
  assert.ok(dn.start >= 18 * 60, "dinner in the evening");

  // Breakfast alone must not cancel lunch.
  const onlyBreakfast = addActivity(trip, 3, restaurantToActivity(breakfast, "Lisbon", "b2"));
  const mealsB = scheduleDay(onlyBreakfast, onlyBreakfast.days[3]).filter((i) => i.kind === "meal").map((i) => i.label);
  assert.ok(mealsB.includes("Lunch"), "lunch is still planned after a breakfast stop");
  assert.match(restaurantRef("Lisbon", lunch), /^food:lisbon:/);
});

test("the departure placeholder stays last when a dinner is added", () => {
  const trip = curateTrip(req);
  const last = trip.days.length - 1;
  const dinner = foodFor(trip, "Lisbon").restaurants.find((r) => r.meal === "dinner")!;
  const t = addActivity(trip, last, restaurantToActivity(dinner, "Lisbon", "dx"));
  assert.equal(t.days[last].activities.at(-1)!.category, "transit");
});

test("Tripadvisor links use the traveller's storefront and pass the redirect allowlist", () => {
  const link = reviewsLink("Belém Tower", "Lisbon", "CAD");
  const url = new URL(link.url);
  assert.equal(url.hostname, "www.tripadvisor.ca");
  assert.equal(url.searchParams.get("q"), "Belém Tower Lisbon");
  assert.ok(hostAllowed(url.hostname));
  assert.equal(new URL(reviewsLink("Castelo, Lisbon", "Lisbon").url).searchParams.get("q"), "Castelo, Lisbon", "city not repeated");
  assert.equal(new URL(topRestaurantsLink("Paris", "GBP").url).hostname, "www.tripadvisor.co.uk");
});

test("trips keep AI food guides through validation", () => {
  const trip = { ...curateTrip(req), food: [{ city: "Porto", dishes: [{ name: "Francesinha", what: "Sandwich." }], restaurants: [{ name: "Café Santiago", area: "Baixa", kind: "Francesinha", price: 2, meal: "lunch", why: "The classic.", book: false }] }] };
  assert.equal(parseTrip(trip)?.food?.[0].restaurants[0].name, "Café Santiago");
  assert.equal(parseTrip({ ...trip, food: [{ ...trip.food[0], restaurants: [{ ...trip.food[0].restaurants[0], price: 9 }] }] }), undefined, "bad price rejected");
});

test("Giro AI writes a food guide only for cities without a curated one", async () => {
  const calls: { messages: { content: string }[] }[] = [];
  const message = {
    stop_reason: "end_turn",
    parsed_output: {
      title: "Porto and Lisbon",
      summary: "Two river cities.",
      days: [],
      stays: [],
      tips: [],
      packing: [],
      food: [
        { city: "Porto", dishes: [{ name: "Francesinha", what: "A meaty sandwich." }], restaurants: [{ name: "Café Santiago", area: "Baixa", kind: "Francesinha", price: 2.4, meal: "lunch", why: "The classic.", book: false }] },
        { city: "Lisbon", dishes: [{ name: "Invented", what: "Should be ignored." }], restaurants: [] },
      ],
    },
  };
  const client = { beta: { messages: { stream: (p: (typeof calls)[number]) => (calls.push(p), { finalMessage: async () => message }) } } } as unknown as Anthropic;
  const trip = await curateWithClaude({ ...req, destinations: ["Porto", "Lisbon"], endDate: "2026-05-16", useAI: true }, { client });
  assert.match(calls[0].messages[0].content, /Food guide needed for: Porto\./);
  assert.deepEqual(trip.food?.map((f) => f.city), ["Porto"]);
  assert.equal(trip.food?.[0].restaurants[0].price, 2);
  assert.equal(foodFor(trip, "Lisbon").source, "giro", "curated guide wins for Lisbon");
});
