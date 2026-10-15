import assert from "node:assert/strict";
import { test } from "node:test";
import { getDb } from "../src/server/db.ts";
import { lookupHours, parseDetails, placeDetails, placeIdFor, placePhotos } from "../src/server/google-places.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ID = "ChIJ_test_belem_0001";
const HOURS = { regularOpeningHours: { periods: [{ open: { day: 2, hour: 10, minute: 0 }, close: { day: 2, hour: 17, minute: 30 } }], weekdayDescriptions: ["Tuesday: 10:00 AM – 5:30 PM"] } };

/** A fake Google: search returns an ID, details returns hours/rating/photos, media returns an image URL. */
function google(log: string[]) {
  return async (url: string, init: RequestInit) => {
    const mask = new Headers(init.headers).get("x-goog-fieldmask") ?? "";
    log.push(url.includes(":searchText") ? `search:${mask}` : url.includes("/media") ? "media" : `details:${mask}`);
    if (url.includes(":searchText")) return json({ places: [{ id: ID }] });
    if (url.includes("/media")) return json({ photoUri: `https://lh3.googleusercontent.com/p/${log.length}` });
    return json({
      id: ID,
      displayName: { text: "Belém Tower" },
      formattedAddress: "Av. Brasília, Lisboa",
      rating: 4.53,
      userRatingCount: 98765,
      priceLevel: "PRICE_LEVEL_MODERATE",
      websiteUri: "https://www.torrebelem.gov.pt/",
      photos: [1, 2, 3].map((n) => ({ name: `places/${ID}/photos/ph${n}`, authorAttributions: [{ displayName: `Author ${n}`, uri: "https://maps.google.com/contrib/1" }] })),
      ...HOURS,
    });
  };
}

async function reset() {
  const db = await getDb();
  await db.query("delete from api_usage");
  await db.query("delete from place_ids");
}

test("google places: off without a key, and only the place ID is stored", async () => {
  await reset();
  delete process.env.GOOGLE_PLACES_API_KEY;
  assert.deepEqual(await lookupHours("Torre de Belém", "Lisbon", async () => { throw new Error("must not call"); }), {});
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  const log: string[] = [];
  const get = google(log);
  const first = await lookupHours("Torre de Belém", "Lisbon", get);
  assert.equal(first.hours?.periods.length, 1);
  assert.match(first.mapsUrl ?? "", /query_place_id=ChIJ_test_belem_0001/);
  assert.deepEqual(log, ["search:places.id", "details:id,regularOpeningHours,businessStatus"], "the ID search is the free IDs-only mask");
  await lookupHours("Torre de Belem", "lisbon", get);
  assert.deepEqual(log.slice(2), ["details:id,regularOpeningHours,businessStatus"], "ID reused (accents/case), hours fetched live again");
  const tables = (await (await getDb()).query<{ table_name: string }>("select table_name from information_schema.tables where table_schema = 'public'")).map((r) => r.table_name);
  assert.ok(!tables.includes("place_hours"), "stored Google hours are gone");
  const stored = await (await getDb()).query("select * from place_ids");
  assert.deepEqual(Object.keys(stored[0]).sort(), ["fetched_at", "key", "place_id"], "nothing but the ID is kept");
  delete process.env.GOOGLE_PLACES_API_KEY;
});

test("google places: details parse, and provider errors stay quiet", async () => {
  await reset();
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  const d = await placeDetails("Torre de Belém", "Lisbon", google([]));
  assert.deepEqual(
    { name: d?.name, rating: d?.rating, count: d?.ratingCount, price: d?.priceLevel, site: d?.website, days: d?.weekdays?.length },
    { name: "Belém Tower", rating: 4.5, count: 98765, price: 2, site: "https://www.torrebelem.gov.pt/", days: 1 },
  );
  assert.equal(parseDetails({ websiteUri: "javascript:alert(1)", rating: 9 }, ID, "x").website, undefined);
  assert.equal(parseDetails({ rating: 9 }, ID, "x").rating, undefined);
  assert.equal(await placeDetails("Nowhere", "Lisbon", async () => json({}, 500)), undefined);
  delete process.env.GOOGLE_PLACES_API_KEY;
});

test("google places: photos carry credits and stop at the monthly cap", async () => {
  await reset();
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  process.env.GOOGLE_PHOTOS_MONTHLY_CAP = "3";
  const log: string[] = [];
  const two = await placePhotos("Torre de Belém", "Lisbon", 2, 800, google(log));
  assert.equal(two.length, 2);
  assert.deepEqual([two[0].author, two[0].authorUrl], ["Author 1", "https://maps.google.com/contrib/1"]);
  assert.match(two[0].src, /^https:\/\/lh3\.googleusercontent\.com\//);
  assert.equal(log.filter((l) => l === "details:id,photos").length, 1, "the photo list uses the free IDs-only mask");
  const more = await placePhotos("Torre de Belém", "Lisbon", 3, 800, google(log));
  assert.equal(more.length, 1, "only one left under a cap of 3");
  assert.equal((await placePhotos("Torre de Belém", "Lisbon", 1, 800, google(log))).length, 0, "over the cap: none (the browser falls back to Wikimedia)");
  process.env.GOOGLE_PLACES_MONTHLY_CAP = "0";
  assert.equal(await placeDetails("Torre de Belém", "Lisbon", google(log)), undefined, "details cap 0 switches details off");
  assert.ok((await placeIdFor("Torre de Belém", "Lisbon", google(log))) === ID, "ID lookups aren't capped (free)");
  delete process.env.GOOGLE_PHOTOS_MONTHLY_CAP;
  delete process.env.GOOGLE_PLACES_MONTHLY_CAP;
  delete process.env.GOOGLE_PLACES_API_KEY;
});
