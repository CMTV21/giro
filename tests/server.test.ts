import assert from "node:assert/strict";
import { before, test } from "node:test";
import { curateTrip } from "../src/lib/curate.ts";
import type { TripRequest } from "../src/lib/types.ts";
import { createSession, hashPassword, sameOrigin, userFromToken, verifyPassword } from "../src/server/auth.ts";
import { HttpError } from "../src/server/errors.ts";
import { acceptInvite, addExpense, createInvite, createTrip, deleteExpense, getTripBundle, listTrips, removeMember, updateTrip, vote } from "../src/server/trips.ts";
import { login, signup, updateProfile } from "../src/server/users.ts";

const req: TripRequest = {
  destinations: ["Lisbon"], origin: "Toronto", startDate: "2026-05-10", endDate: "2026-05-14",
  adults: 3, children: 0, budgetTier: "comfort", pace: "balanced", interests: ["food"], stayType: "apartment",
};

const status = (code: number) => (err: unknown) => err instanceof HttpError && err.status === code;
let ana: Awaited<ReturnType<typeof signup>>, ben: Awaited<ReturnType<typeof signup>>, cy: Awaited<ReturnType<typeof signup>>;

before(async () => {
  ana = await signup({ email: "Ana@Example.com", password: "correct horse battery", name: "Ana" });
  ben = await signup({ email: "ben@example.com", password: "another long password", name: "Ben", homeCurrency: "EUR" });
  cy = await signup({ email: "cy@example.com", password: "a third long password", name: "Cy" });
});

test("passwords hash with salt and verify", async () => {
  const a = await hashPassword("hunter2hunter2");
  const b = await hashPassword("hunter2hunter2");
  assert.notEqual(a, b);
  assert.ok(await verifyPassword("hunter2hunter2", a));
  assert.ok(!(await verifyPassword("hunter2hunter3", a)));
});

test("signup normalises email, defaults to CAD, rejects duplicates and weak passwords", async () => {
  assert.equal(ana.email, "ana@example.com");
  assert.equal(ana.homeCurrency, "CAD");
  assert.equal(ben.homeCurrency, "EUR");
  await assert.rejects(signup({ email: "ANA@example.com", password: "whatever long pw", name: "x" }), status(409));
  await assert.rejects(signup({ email: "new@example.com", password: "short", name: "x" }), status(400));
});

test("login checks credentials and sessions resolve to the user", async () => {
  await assert.rejects(login({ email: "ana@example.com", password: "wrong password!!" }, "1.1.1.1"), status(401));
  await assert.rejects(login({ email: "nobody@example.com", password: "wrong password!!" }, "1.1.1.1"), status(401));
  const user = await login({ email: " ANA@example.com ", password: "correct horse battery" }, "1.1.1.1");
  const { token } = await createSession(user.id);
  assert.equal((await userFromToken(token))?.id, ana.id);
  assert.equal(await userFromToken("forged-token"), undefined);
});

test("login is rate limited per email", async () => {
  for (let i = 0; i < 10; i++) await login({ email: "cy@example.com", password: "nope nope nope" }, "2.2.2.2").catch(() => {});
  await assert.rejects(login({ email: "cy@example.com", password: "a third long password" }, "2.2.2.2"), status(429));
});

test("profile updates validate currency", async () => {
  const u = await updateProfile(ana.id, { homeAirport: "YYZ", homeCurrency: "XXX" });
  assert.equal(u.homeAirport, "YYZ");
  assert.equal(u.homeCurrency, "CAD");
});

test("same-origin guard blocks cross-site mutations", () => {
  const mk = (h: Record<string, string>) => new Request("https://giro.app/api/x", { method: "POST", headers: h });
  assert.ok(sameOrigin(mk({ "sec-fetch-site": "same-origin" })));
  assert.ok(!sameOrigin(mk({ "sec-fetch-site": "cross-site" })));
  assert.ok(sameOrigin(mk({ origin: "https://giro.app", host: "giro.app" })));
  assert.ok(!sameOrigin(mk({ origin: "https://evil.example", host: "giro.app" })));
  assert.ok(!sameOrigin(mk({})));
});

test("group trip lifecycle: invite, edit with conflicts, vote, split costs", async () => {
  const { trip, version } = await createTrip(ana.id, curateTrip(req));
  await assert.rejects(getTripBundle(trip.id, ben.id), status(403));
  await assert.rejects(createTrip(ana.id, { ...trip, days: "nope" }), status(400));

  const viewToken = await createInvite(trip.id, ana.id, "viewer");
  await acceptInvite(viewToken, ben.id);
  const editToken = await createInvite(trip.id, ana.id, "editor");
  await acceptInvite(editToken, cy.id);
  await assert.rejects(acceptInvite("bogus", cy.id), status(410));

  // Viewers can't edit; editors can, but only from the latest version.
  await assert.rejects(updateTrip(trip.id, ben.id, trip, version), status(403));
  const renamed = { ...trip, title: "Lisbon with friends" };
  const v2 = await updateTrip(trip.id, cy.id, renamed, version);
  assert.equal(v2.version, version + 1);
  await assert.rejects(updateTrip(trip.id, ana.id, { ...trip, title: "stale" }, version), status(409));

  const activityId = trip.days[1].activities[0].id;
  await vote(trip.id, ben.id, activityId, 1);
  await vote(trip.id, cy.id, activityId, 1);
  await vote(trip.id, ana.id, activityId, -1);

  await addExpense(trip.id, ana.id, { paidBy: ana.id, amount: 300, currency: "USD", description: "Apartment deposit", splitBetween: [ana.id, ben.id, cy.id] });
  const eur = await addExpense(trip.id, ben.id, { paidBy: ben.id, amount: 88, currency: "EUR", description: "Dinner", splitBetween: [ben.id, cy.id] }, { USD: 1, EUR: 0.88 } as never);
  assert.equal(eur.amountUSD, 100);
  await assert.rejects(addExpense(trip.id, ana.id, { paidBy: "stranger", amount: 5, currency: "USD", description: "x", splitBetween: [ana.id] }), status(400));

  const bundle = await getTripBundle(trip.id, ben.id);
  assert.equal(bundle.trip.title, "Lisbon with friends");
  assert.equal(bundle.role, "viewer");
  assert.equal(bundle.members.length, 3);
  assert.deepEqual([bundle.votes[activityId].up, bundle.votes[activityId].down, bundle.votes[activityId].mine], [2, 1, 1]);
  assert.equal(Math.round(Object.values(bundle.balancesUSD).reduce((s, v) => s + v, 0) * 100), 0);
  assert.equal(bundle.balancesUSD[ana.id], 200);
  assert.ok(bundle.settleUSD.every((t) => t.to === ana.id || t.to === ben.id));

  // Only the payer, creator or owner can delete an expense.
  const anaExpense = bundle.expenses.find((e) => e.paidBy === ana.id)!;
  await assert.rejects(deleteExpense(trip.id, cy.id, anaExpense.id), status(403));
  await deleteExpense(trip.id, ana.id, anaExpense.id);

  assert.equal((await listTrips(ben.id)).length, 1);
  await removeMember(trip.id, ben.id, ben.id);
  assert.equal((await listTrips(ben.id)).length, 0);
  await assert.rejects(removeMember(trip.id, cy.id, ana.id), status(403));
});

test("importing someone else's trip id creates a copy instead of overwriting", async () => {
  const { trip } = await createTrip(ana.id, curateTrip(req));
  const copy = await createTrip(ben.id, trip);
  assert.notEqual(copy.trip.id, trip.id);
  assert.equal((await getTripBundle(trip.id, ana.id)).role, "owner");
});

test("click tracker only redirects to partner sites and logs commission", async () => {
  const { recordClick, revenueReport, safePartnerUrl } = await import("../src/server/clicks.ts");
  assert.equal(safePartnerUrl("https://evil.example/booking.com"), undefined);
  assert.equal(safePartnerUrl("https://booking.com.evil.example/"), undefined);
  assert.equal(safePartnerUrl("javascript:alert(1)"), undefined);
  assert.equal(safePartnerUrl("http://www.booking.com/"), undefined, "https only");
  assert.ok(safePartnerUrl("https://www.expedia.ca/Hotel-Search"));
  const out = await recordClick({ url: "https://www.booking.com/searchresults.html?ss=Lisbon", provider: "Booking.com", kind: "stays", valueUSD: 1000 });
  assert.match(out!, /label=giro-/);
  const spoof = await recordClick({ url: "https://www.getyourguide.com/s/?q=x", provider: "Booking.com", kind: "stays", valueUSD: 1000 });
  assert.ok(spoof && !/label=/.test(spoof) && /cmp=giro-/.test(spoof), "attribution follows the host, not the claimed provider");
  assert.equal(await recordClick({ url: "https://evil.example/", provider: "Booking.com", kind: "stays" }), undefined);
  const report = await revenueReport();
  const booking = report.rows.find((r) => r.provider === "Booking.com")!;
  assert.equal(booking.clicks, 1);
  assert.ok(Math.abs(booking.expectedUSD - 1000 * 0.04 * 0.04) < 0.001);
});
