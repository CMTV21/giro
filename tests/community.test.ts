import assert from "node:assert/strict";
import { test } from "node:test";
import { curateTrip } from "../src/lib/curate.ts";
import type { Trip, TripRequest } from "../src/lib/types.ts";
import { communityPicks, resetCommunityCache } from "../src/server/community.ts";
import { acceptInvite, createInvite, createTrip, vote } from "../src/server/trips.ts";
import { signup } from "../src/server/users.ts";

const req: TripRequest = { destinations: ["Lisbon"], origin: "", startDate: "2026-05-10", endDate: "2026-05-14", adults: 2, children: 0, budgetTier: "comfort", pace: "balanced", interests: ["food"], stayType: "hotel" };
const user = (n: number) => signup({ email: `c${n}@example.com`, password: "a long enough password", name: `C${n}` });

/** A trip where `ref` is in day 1 with the given flags. */
function tripWith(ref: string, flags: { picked?: boolean; booked?: boolean }): Trip {
  const t = curateTrip(req);
  const day = t.days[1];
  const a = { id: `a-${ref}-${Math.random().toString(36).slice(2, 8)}`, title: ref, description: "", category: "culture" as const, slot: "afternoon" as const, durationHrs: 2, estCost: 0, ref, ...flags };
  return { ...t, days: t.days.map((d) => (d === day ? { ...d, activities: [...d.activities.filter((x) => x.ref !== ref), a] } : d)) };
}

test("a stop becomes a community pick only once 3 different travellers back it", async () => {
  const [u1, u2, u3] = await Promise.all([user(1), user(2), user(3)]);
  await createTrip(u1.id, tripWith("gulbenkian", { picked: true }));
  await createTrip(u1.id, tripWith("gulbenkian", { booked: true }));
  await createTrip(u2.id, tripWith("gulbenkian", { picked: true }));
  // Placed by Giro, not chosen: doesn't count.
  await createTrip(u3.id, tripWith("gulbenkian", {}));
  resetCommunityCache();
  assert.equal((await communityPicks()).has("gulbenkian"), false, "two travellers (one with two trips) isn't enough");

  await createTrip(u3.id, tripWith("gulbenkian", { booked: true }));
  resetCommunityCache();
  assert.deepEqual((await communityPicks()).get("gulbenkian"), { travellers: 3, booked: 2 });
});

test("group upvotes count as backing; strong opposition hides a pick", async () => {
  const [owner, v1, v2, v3, v4] = await Promise.all([user(10), user(11), user(12), user(13), user(14)]);
  const { trip } = await createTrip(owner.id, tripWith("oceanario", {}));
  for (const m of [v1, v2, v3, v4]) await acceptInvite(await createInvite(trip.id, owner.id, "editor"), m.id);
  const act = trip.days[1].activities.find((a) => a.ref === "oceanario")!;
  await vote(trip.id, v1.id, act.id, 1);
  await vote(trip.id, v2.id, act.id, 1);
  await vote(trip.id, v3.id, act.id, 1);
  resetCommunityCache();
  assert.equal((await communityPicks()).get("oceanario")?.travellers, 3);

  await vote(trip.id, v4.id, act.id, -1);
  await vote(trip.id, owner.id, act.id, -1);
  resetCommunityCache();
  assert.equal((await communityPicks()).has("oceanario"), false, "3 for, 2 against isn't a clear favourite");
});
