import assert from "node:assert/strict";
import { test } from "node:test";
import { keywords, matchesStop, parseViatorProduct } from "../src/lib/tours.ts";
import { findTour } from "../src/server/tours.ts";

const product = (over: Record<string, unknown> = {}) => ({
  productCode: "5678P1",
  title: "Belém Tower and Jerónimos Monastery Skip-the-Line Tour",
  productUrl: "https://www.viator.com/tours/Lisbon/Belem/d538-5678P1?pid=P00123&mcid=42383",
  pricing: { summary: { fromPrice: 54.2 }, currency: "CAD" },
  reviews: { combinedAverageRating: 4.78, totalReviews: 12431 },
  duration: { fixedDurationInMinutes: 150 },
  flags: ["FREE_CANCELLATION", "LIKELY_TO_SELL_OUT"],
  ...over,
});

test("product parsing keeps checked fields only", () => {
  const o = parseViatorProduct(product(), "CAD")!;
  assert.deepEqual(o, { provider: "Viator", code: "5678P1", title: "Belém Tower and Jerónimos Monastery Skip-the-Line Tour", url: product().productUrl, fromPrice: 54.2, currency: "CAD", rating: 4.8, reviews: 12431, freeCancellation: true, durationMins: 150 });
  assert.equal(parseViatorProduct(product({ productUrl: "https://evil.example/viator.com" }), "CAD"), undefined, "only viator.com links");
  assert.equal(parseViatorProduct(product({ productUrl: "http://www.viator.com/x" }), "CAD"), undefined, "https only");
  assert.equal(parseViatorProduct(product({ title: "" }), "CAD"), undefined);
  assert.equal(parseViatorProduct(product(), "EUR")!.fromPrice, undefined, "a price in another currency isn't shown as ours");
  assert.equal(parseViatorProduct(product({ reviews: { combinedAverageRating: 9 } }), "CAD")!.rating, undefined);
});

test("a tour only counts when it's about the stop", () => {
  assert.deepEqual(keywords("Belém monuments"), ["belem", "monuments"]);
  assert.ok(matchesStop("Belém monuments", "Belém Tower and Jerónimos Monastery"));
  assert.ok(!matchesStop("Alfama and São Jorge Castle", "Sintra and Cascais Day Trip"));
  assert.ok(!matchesStop("Old town walk", "Old Town Walking Tour of Prague"), "generic words don't match");
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("search sends the partner headers, skips unrelated results, and caches", async () => {
  delete process.env.VIATOR_API_KEY;
  assert.equal(await findTour("Torre de Belém", "Lisbon", "CAD", async () => { throw new Error("must not call"); }), undefined);
  process.env.VIATOR_API_KEY = "viator-test";
  let calls = 0;
  const fake = async (url: string, init: RequestInit) => {
    calls++;
    const h = new Headers(init.headers);
    assert.equal(url, "https://api.viator.com/partner/search/freetext");
    assert.equal(h.get("exp-api-key"), "viator-test");
    assert.equal(h.get("accept"), "application/json;version=2.0");
    const body = JSON.parse(String(init.body));
    assert.equal(body.currency, "CAD");
    assert.equal(body.searchTypes[0].searchType, "PRODUCTS");
    return json({ products: { results: [product({ productCode: "X1", title: "Sintra Day Trip from Lisbon" }), product()] } });
  };
  const o = await findTour("Belém monuments", "Lisbon", "CAD", fake);
  assert.equal(o?.code, "5678P1", "the unrelated first result is skipped");
  assert.equal((await findTour("Belém monuments", "Lisbon", "CAD", fake))?.code, "5678P1");
  assert.equal(calls, 1, "cached");
  const none = await findTour("Some tiny chapel", "Lisbon", "CAD", async () => json({ products: { results: [product({ title: "Fado Night" })] } }));
  assert.equal(none, undefined);
  assert.equal(await findTour("Broken provider", "Lisbon", "CAD", async () => json({}, 503)), undefined);
  delete process.env.VIATOR_API_KEY;
});
