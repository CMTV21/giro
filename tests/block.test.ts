import assert from "node:assert/strict";
import { test } from "node:test";
import { curateTrip, suggestAlternatives } from "../src/lib/curate.ts";
import { catalogStop } from "../src/lib/destinations.ts";
import { ideasFor } from "../src/lib/ideas.ts";
import { applySignal, emptyTaste, mergeTaste, parseTaste, withBlocked } from "../src/lib/taste.ts";
import type { TripRequest } from "../src/lib/types.ts";

const req: TripRequest = { destinations: ["Lisbon"], origin: "", startDate: "2026-05-10", endDate: "2026-05-15", adults: 2, children: 0, budgetTier: "comfort", pace: "balanced", interests: ["food", "history"], stayType: "hotel" };
const refs = (t: ReturnType<typeof curateTrip>) => t.days.flatMap((d) => d.activities.map((a) => a.ref)).filter(Boolean);

test("blocked stops never come back in plans, swaps or ideas", () => {
  const open = curateTrip(req);
  const victim = refs(open)[0]!;
  const taste = withBlocked(emptyTaste(), victim, true);
  const trip = curateTrip(req, { taste });
  assert.ok(!refs(trip).includes(victim));
  for (let d = 0; d < trip.days.length; d++) for (const s of ["morning", "afternoon", "evening"] as const) assert.ok(!suggestAlternatives(trip, d, s, 10, taste).some((a) => a.ref === victim));
  assert.ok(!ideasFor(trip, "Lisbon", taste).some((i) => i.ref === victim));
  const back = withBlocked(taste, victim, false);
  assert.equal(back.blocked, undefined, "unblocking clears it");
});

test("blocks survive signals, merging and the account round trip, and junk is dropped", () => {
  let t = withBlocked(emptyTaste(), "fado", true);
  t = applySignal(t, "booked", "food");
  assert.deepEqual(t.blocked, ["fado"], "recording a signal keeps blocks");
  const merged = mergeTaste(t, withBlocked(emptyTaste(), "surf", true));
  assert.deepEqual(merged.blocked!.sort(), ["fado", "surf"]);
  assert.deepEqual(parseTaste(JSON.parse(JSON.stringify(merged)))!.blocked!.sort(), ["fado", "surf"]);
  assert.equal(parseTaste({ weights: {}, blocked: ["<script>", 5, "ok-key"] })!.blocked!.join(), "ok-key");
  assert.equal(withBlocked(emptyTaste(), "Bad Key!", true).blocked, undefined);
  assert.deepEqual(catalogStop("fado"), { title: "Fado dinner", city: "Lisbon" });
});
