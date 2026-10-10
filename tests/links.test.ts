import assert from "node:assert/strict";
import { before, test } from "node:test";
import { curateTrip } from "../src/lib/curate.ts";
import { tripToICS } from "../src/lib/export.ts";
import type { TripRequest } from "../src/lib/types.ts";
import { HttpError } from "../src/server/errors.ts";
import { isLinkToken, tripForLink, tripLink } from "../src/server/links.ts";
import { acceptInvite, createInvite, createTrip } from "../src/server/trips.ts";
import { signup } from "../src/server/users.ts";
import { calendarLinks } from "../src/lib/calendar-links.ts";

const req: TripRequest = {
  destinations: ["Lisbon"], origin: "", startDate: "2026-05-10", endDate: "2026-05-13",
  adults: 2, children: 0, budgetTier: "comfort", pace: "balanced", interests: ["food"], stayType: "hotel",
};
const status = (code: number) => (err: unknown) => err instanceof HttpError && err.status === code;
let owner: Awaited<ReturnType<typeof signup>>, viewer: Awaited<ReturnType<typeof signup>>, stranger: Awaited<ReturnType<typeof signup>>;
let tripId: string;

before(async () => {
  owner = await signup({ email: "links-owner@example.com", password: "a long enough password", name: "Owner" });
  viewer = await signup({ email: "links-viewer@example.com", password: "a long enough password", name: "Viewer" });
  stranger = await signup({ email: "links-stranger@example.com", password: "a long enough password", name: "Stranger" });
  tripId = (await createTrip(owner.id, curateTrip(req))).trip.id;
  await acceptInvite(await createInvite(tripId, owner.id, "viewer"), viewer.id);
});

test("calendar links are stable, open the trip, and only for members", async () => {
  const token = await tripLink(tripId, owner.id, "calendar");
  assert.ok(isLinkToken(token));
  assert.equal(await tripLink(tripId, viewer.id, "calendar"), token, "every member gets the same link");
  assert.equal((await tripForLink(token, "calendar"))?.trip.id, tripId);
  assert.equal(await tripForLink(token, "inbox"), undefined, "a calendar token isn't an inbox address");
  assert.equal(await tripForLink("not-a-token", "calendar"), undefined);
  await assert.rejects(tripLink(tripId, stranger.id, "calendar"), status(403));
});

test("replacing a link turns the old one off; viewers can't replace or get the inbox", async () => {
  const old = await tripLink(tripId, owner.id, "calendar");
  await assert.rejects(tripLink(tripId, viewer.id, "calendar", { rotate: true }), status(403));
  await assert.rejects(tripLink(tripId, viewer.id, "inbox"), status(403));
  const fresh = await tripLink(tripId, owner.id, "calendar", { rotate: true });
  assert.notEqual(fresh, old);
  assert.equal(await tripForLink(old, "calendar"), undefined);
  assert.equal((await tripForLink(fresh, "calendar"))?.trip.id, tripId);
});

test("feeds ask calendars to refresh; app links are well formed", () => {
  const ics = tripToICS(curateTrip(req), { feed: true });
  assert.match(ics, /REFRESH-INTERVAL;VALUE=DURATION:PT3H/);
  assert.doesNotMatch(tripToICS(curateTrip(req)), /REFRESH-INTERVAL/);
  const l = calendarLinks("https://girotrips.com/cal/abc.ics", "4 days in Lisbon");
  assert.equal(l.apple, "webcal://girotrips.com/cal/abc.ics");
  assert.match(l.google, /cid=webcal%3A%2F%2Fgirotrips\.com%2Fcal%2Fabc\.ics$/);
  assert.match(l.outlook, /url=https%3A%2F%2Fgirotrips\.com/);
});
