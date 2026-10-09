import assert from "node:assert/strict";
import { test } from "node:test";
import { discover } from "../src/lib/discover.ts";

const fx = { currency: "CAD" as const, rate: 1.38, asOf: "", source: "fallback" as const };
const base = { fx, origin: "Toronto", startDate: "2026-05-04", nights: 6, adults: 2, children: 0, interests: ["food" as const] };

test("only returns trips under budget, upgrading tiers when money allows", () => {
  const { fits } = discover({ ...base, budget: 6000 });
  assert.ok(fits.length > 0);
  assert.ok(fits.every((r) => r.total <= 6000));
  const rich = discover({ ...base, budget: 60000 }).fits;
  assert.ok(rich.every((r) => r.tier === "luxury"));
});

test("a tiny budget yields nothing that fits, but near-misses as stretch options", () => {
  const { fits, stretch } = discover({ ...base, budget: 300 });
  assert.equal(fits.length, 0);
  assert.ok(stretch.every((r) => r.total <= 300 * 1.15));
});

test("in-season destinations rank first when budget isn't the constraint", () => {
  const { fits } = discover({ ...base, budget: 50000, interests: [] });
  assert.ok(fits.some((r) => r.inSeason));
  assert.ok(fits[0].inSeason);
  assert.ok(!fits.some((r) => r.destination.name === "Toronto"));
});
