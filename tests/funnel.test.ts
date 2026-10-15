import assert from "node:assert/strict";
import { test } from "node:test";
import { getDb } from "../src/server/db.ts";
import { decide, grade, joinWaitlist, launchScorecard, recordEvent, type Metric } from "../src/server/funnel.ts";

const m = (key: string, verdict: Metric["verdict"]): Metric => ({ key, label: key, definition: "", value: 0, ratio: true, go: 1, stop: 0, verdict, early: false });
const all = (verdicts: Record<string, Metric["verdict"]>) =>
  ["planned", "invite_rate", "acceptance", "click_through", "pass_intent", "passes_sold"].map((k) => m(k, verdicts[k] ?? "iterate"));

test("funnel: thresholds grade Go, Iterate and Stop", () => {
  assert.equal(grade(0.25, 0.25, 0.1), "go", "the Go threshold itself is Go");
  assert.equal(grade(0.1, 0.25, 0.1), "iterate", "the Stop threshold itself is not Stop");
  assert.equal(grade(0.09, 0.25, 0.1), "stop");
});

test("funnel: the plan's decision rule", () => {
  assert.equal(decide(all({ planned: "go", invite_rate: "go", acceptance: "go", click_through: "go" })), "go");
  assert.equal(decide(all({ planned: "go", invite_rate: "go", acceptance: "go", click_through: "go", passes_sold: "stop" })), "iterate", "any Stop blocks Go");
  assert.equal(decide(all({ planned: "go", invite_rate: "go", acceptance: "go" })), "iterate", "three Go isn't enough");
  assert.equal(decide(all({ invite_rate: "stop", pass_intent: "stop", passes_sold: "stop" })), "stop", "the group thesis failed");
  assert.equal(decide(all({ invite_rate: "stop", pass_intent: "stop" })), "iterate", "pass sales still open");
});

test("funnel: waitlist is idempotent and the scorecard counts the experiment", async () => {
  const db = await getDb();
  const since = "2026-01-01";
  await db.query("insert into users (id, email, name, password_hash) values ('fu1', 'fu1@example.com', 'Org', 'x'), ('fu2', 'fu2@example.com', 'Friend', 'x')");
  await db.query(`insert into trips (id, owner_id, data) values ('ft1', 'fu1', '{}'), ('ft2', 'fu1', '{}')`);
  await db.query("insert into trip_members (trip_id, user_id, role) values ('ft1', 'fu1', 'owner'), ('ft1', 'fu2', 'editor'), ('ft2', 'fu1', 'owner')");
  await db.query("insert into trip_invites (token_hash, trip_id, role, created_by, expires_at) values ('fh1', 'ft1', 'editor', 'fu1', now() + interval '7 days')");
  await db.query("insert into clicks (id, trip_id, provider, kind) values ('fc1', 'ft1', 'Booking.com', 'stay'), ('fc2', 'local1', 'Expedia', 'stay')");
  for (const id of ["ft1", "ft2", "local1", "local2"]) await recordEvent("planned", id, { cities: 1 });
  await recordEvent("pass_viewed", "ft1");

  assert.equal(await joinWaitlist({ email: "Org@Example.com ", userId: "fu1", tripId: "ft1" }), true);
  assert.equal(await joinWaitlist({ email: "org@example.com" }), false, "same email, any case, isn't added twice");

  const card = await launchScorecard(since);
  assert.deepEqual(
    { ...card.counts },
    { planned: 4, saved: 2, groupTrips: 1, invites: 1, joined: 1, clickedTrips: 2, passViews: 1, waitlist: 1, paid: 0 },
  );
  const value = (k: string) => card.metrics.find((x) => x.key === k)!.value;
  assert.equal(value("invite_rate"), 0.5, "1 of 2 saved trips sent an invite");
  assert.equal(value("acceptance"), 1);
  assert.equal(value("click_through"), 0.5, "2 of the 4 known trips (local ones included) clicked");
  assert.equal(value("pass_intent"), 1, "1 sign-up for 1 group trip");
  assert.equal(card.metrics.find((x) => x.key === "invite_rate")!.early, true, "2 saved trips is too few to judge");

  const later = await launchScorecard("2999-01-01");
  assert.equal(later.counts.planned, 0, "only events since day 0 count");
});
