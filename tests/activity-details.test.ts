import assert from "node:assert/strict";
import { test } from "node:test";
import { DETAILS } from "../src/data/activity-details/index.ts";
import { detailsFor } from "../src/lib/activity-details.ts";
import { DESTINATIONS } from "../src/lib/destinations.ts";

test("activity details: every catalog activity has them, and nothing else does", () => {
  const missing: string[] = [];
  for (const d of DESTINATIONS) {
    const keys = new Set(d.activities.map((a) => a.key));
    for (const a of d.activities) if (!DETAILS[d.slug]?.[a.key]) missing.push(`${d.slug}/${a.key}`);
    for (const k of Object.keys(DETAILS[d.slug] ?? {})) assert.ok(keys.has(k), `${d.slug}/${k} isn't a catalog activity`);
  }
  assert.deepEqual(missing, []);
});

test("activity details: complete, sensible length, house style", () => {
  for (const [slug, byKey] of Object.entries(DETAILS)) {
    for (const [key, d] of Object.entries(byKey)) {
      const id = `${slug}/${key}`;
      assert.ok(d.about.length >= 80 && d.about.length <= 900, `${id}: about is ${d.about.length} chars`);
      assert.ok(d.bestTime.length >= 20, `${id}: bestTime`);
      assert.ok(d.tickets.length >= 15, `${id}: tickets`);
      for (const text of [d.about, d.bestTime, d.tickets, d.access ?? ""]) {
        assert.ok(!text.includes("—"), `${id}: no em dashes`);
        assert.ok(!text.includes("!"), `${id}: no exclamation marks`);
        assert.ok(!/hidden gem|must-see|breathtaking/i.test(text), `${id}: no clichés`);
      }
    }
  }
});

test("activity details: found by city name and catalog key", () => {
  const lisbon = DESTINATIONS.find((d) => d.slug === "lisbon")!;
  const first = lisbon.activities[0];
  assert.equal(detailsFor({ ref: first.key }, "Lisbon"), DETAILS.lisbon[first.key]);
  assert.equal(detailsFor({ ref: first.key }, "lisboa"), DETAILS.lisbon[first.key], "city aliases work");
  assert.equal(detailsFor({ ref: undefined }, "Lisbon"), undefined, "your own stops have none");
});
