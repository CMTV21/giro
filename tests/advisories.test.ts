import assert from "node:assert/strict";
import { test } from "node:test";
import { COUNTRY_ISO, nextSeen, parseAdvisories, raisedSince } from "../src/lib/advisories.ts";
import { DESTINATIONS } from "../src/lib/destinations.ts";

// Shape of the Government of Canada feed (data.international.gc.ca/travel-voyage/index-updated.json).
const sample = {
  metadata: { generated: { timestamp: 1791590000, date: "2026-10-09 12:00:00" } },
  data: {
    PT: { "country-iso": "PT", "country-eng": "Portugal", "advisory-state": 0, "has-regional-advisory": 0, "date-published": { timestamp: 1790000000, date: "2026-09-20 10:00:00" }, eng: { name: "Portugal", "url-slug": "portugal", "advisory-text": "Take normal security precautions" } },
    MX: { "country-iso": "MX", "advisory-state": "1", "has-regional-advisory": 1, "date-published": { date: "2026-10-01 09:00:00" }, eng: { name: "Mexico", "url-slug": "mexico" } },
    XX: { "advisory-state": 7, eng: { name: "Bad" } },
    TH: "garbage",
    ZZ: { eng: { name: "No level" } },
  },
};

test("parses levels, regional flags, dates and official links; drops bad rows", () => {
  const m = parseAdvisories(sample);
  assert.deepEqual([...m.keys()].sort(), ["MX", "PT"]);
  const pt = m.get("PT")!;
  assert.equal(pt.level, 0);
  assert.equal(pt.updated, "2026-09-20");
  assert.equal(pt.url, "https://travel.gc.ca/destinations/portugal");
  const mx = m.get("MX")!;
  assert.equal(mx.level, 1, "numeric strings accepted");
  assert.equal(mx.regional, true);
  assert.equal(parseAdvisories(null).size, 0);
  assert.equal(parseAdvisories({ data: [] }).size, 0);
});

test("unsafe slugs fall back to the advisories index", () => {
  const m = parseAdvisories({ data: { FR: { "advisory-state": 1, eng: { name: "France", "url-slug": "../evil" } } } });
  assert.equal(m.get("FR")!.url, "https://travel.gc.ca/travelling/advisories");
});

test("raised levels are flagged once, then remembered", () => {
  const now = [...parseAdvisories(sample).values()];
  assert.deepEqual(raisedSince(undefined, now), [], "first view flags nothing");
  const seen = nextSeen(undefined, now)!;
  assert.deepEqual(seen, { PT: 0, MX: 1 });
  assert.equal(nextSeen(seen, now), undefined, "nothing changed");
  const later = now.map((a) => (a.iso === "MX" ? { ...a, level: 2 as const } : a));
  assert.deepEqual(raisedSince(seen, later).map((a) => a.iso), ["MX"]);
  assert.deepEqual(nextSeen(seen, later), { PT: 0, MX: 2 });
});

test("every catalog country has an ISO code", () => {
  for (const d of DESTINATIONS) assert.match(COUNTRY_ISO[d.country] ?? "", /^[A-Z]{2}$/, d.country);
});
