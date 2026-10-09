import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogIssues, DestinationSchema } from "../src/lib/catalog-schema.ts";
import { DESTINATIONS, findDestination } from "../src/lib/destinations.ts";

test("every catalog city satisfies the schema and integrity rules", () => {
  const slugs = new Set<string>();
  for (const d of DESTINATIONS) {
    const parsed = DestinationSchema.safeParse(d);
    assert.ok(parsed.success, `${d.slug}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))}`);
    assert.deepEqual(catalogIssues(parsed.data), [], d.slug);
    assert.ok(!slugs.has(d.slug), `duplicate slug ${d.slug}`);
    slugs.add(d.slug);
  }
  assert.ok(DESTINATIONS.length >= 25);
});

test("aliases resolve to the right city", () => {
  assert.equal(findDestination("montreal")?.slug, "montreal");
  assert.equal(findDestination("Firenze")?.slug, "florence");
  assert.equal(findDestination("Tulum")?.slug, "cancun");
  assert.equal(findDestination("Praha")?.slug, "prague");
});
