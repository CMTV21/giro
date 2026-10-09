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

test("database URLs from Neon are cleaned of libpq-only options", async () => {
  const { cleanDatabaseUrl } = await import("../src/server/db.ts");
  const out = cleanDatabaseUrl("postgresql://user:pw@ep-x-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");
  assert.equal(out, "postgresql://user:pw@ep-x-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require");
});

test("password reset: single-use link, signs out old sessions, no account enumeration", async () => {
  const { outbox } = await import("../src/server/email.ts");
  const { requestPasswordReset, resetPassword } = await import("../src/server/users.ts");
  const user = await signup({ email: "reset@example.com", password: "original password", name: "Rae" });
  const { token: oldSession } = await createSession(user.id);

  assert.equal(await requestPasswordReset("nobody-here@example.com", "9.9.9.9"), undefined, "unknown emails look identical to callers");
  const before = outbox.length;
  await requestPasswordReset("RESET@example.com", "9.9.9.9");
  assert.equal(outbox.length, before + 1);
  const mail = outbox.at(-1)!;
  assert.equal(mail.to, "reset@example.com");
  const token = mail.text.match(/\/reset\/([A-Za-z0-9_-]+)/)![1];

  await assert.rejects(resetPassword(token, "short"), status(400));
  const updated = await resetPassword(token, "brand new password");
  assert.ok(updated.emailVerified, "following an emailed link verifies the address");
  await assert.rejects(resetPassword(token, "another new password"), status(410), "links work once");
  assert.equal(await userFromToken(oldSession), undefined, "old sessions are revoked");
  await assert.rejects(login({ email: "reset@example.com", password: "original password" }, "9.9.9.9"), status(401));
  assert.equal((await login({ email: "reset@example.com", password: "brand new password" }, "9.9.9.9")).id, user.id);

  // Requesting again revokes the previous unused link.
  await requestPasswordReset("reset@example.com", "9.9.9.9");
  const first = outbox.at(-1)!.text.match(/\/reset\/([A-Za-z0-9_-]+)/)![1];
  await requestPasswordReset("reset@example.com", "9.9.9.9");
  await assert.rejects(resetPassword(first, "yet another password"), status(410));
});

test("email verification marks the account verified", async () => {
  const { outbox } = await import("../src/server/email.ts");
  const { confirmEmail, sendVerification } = await import("../src/server/users.ts");
  const user = await signup({ email: "verify@example.com", password: "verify me please", name: "Vee <script>" });
  assert.equal(user.emailVerified, false);
  await sendVerification(user);
  const mail = outbox.at(-1)!;
  const token = mail.text.match(/\/verify\/([A-Za-z0-9_-]+)/)![1];
  await confirmEmail(token);
  const { token: session } = await createSession(user.id);
  assert.equal((await userFromToken(session))?.emailVerified, true);
  await assert.rejects(confirmEmail(token), status(410));
});

test("email templates escape user-provided text", async () => {
  const { inviteEmail } = await import("../src/server/email.ts");
  const m = inviteEmail("https://giro.app/join/x", "<b>Eve</b>", "Trip <img src=x onerror=alert(1)>", "viewer");
  assert.ok(!m.html.includes("<img"));
  assert.ok(m.html.includes("&lt;b&gt;Eve&lt;/b&gt;"));
});

test("place lookups are cached, including misses, with credited Commons photos", async () => {
  const { lookupPlace } = await import("../src/server/places.ts");
  let calls = 0;
  const thumb = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Torre_de_Bel%C3%A9m.jpg/320px-Torre_de_Bel%C3%A9m.jpg";
  const fake = async (url: string) => {
    calls++;
    if (url.includes("list=search")) return { query: { search: [{ title: "Belém Tower" }] } };
    if (url.includes("/page/summary/")) return { type: "standard", title: "Belém Tower", extract: "Belém Tower is a 16th-century fortification in Lisbon.", coordinates: { lat: 38.6916, lon: -9.216 }, thumbnail: { source: thumb } };
    if (url.includes("commons.wikimedia.org")) return { query: { pages: [{ imageinfo: [{ extmetadata: { Artist: { value: '<a href="//x">Jane Doe</a>' }, LicenseShortName: { value: "CC BY-SA 4.0" } } }] }] } };
    return [];
  };
  const a = await lookupPlace("Belém Tower", "Lisbon", {}, fake);
  assert.equal(a.source, "wikipedia");
  assert.equal(a.thumbnail, thumb);
  assert.deepEqual(a.photo, { page: "https://commons.wikimedia.org/wiki/File:Torre_de_Bel%C3%A9m.jpg", author: "Jane Doe", license: "CC BY-SA 4.0" });
  assert.equal(a.facts, undefined, "facts aren't generated unless asked for");
  const before = calls;
  const b = await lookupPlace("Belém Tower", "Lisbon", { facts: true }, fake);
  assert.equal(calls, before, "served from cache");
  assert.equal(b.title, "Belém Tower");
  assert.equal(b.photo?.author, "Jane Doe");
  const miss = await lookupPlace("Nowhere special", "Lisbon", {}, async () => ({ query: { search: [] } }));
  assert.equal(miss.source, "none");
});

test("strict lookups (restaurants) need an article with coordinates near the city", async () => {
  const { lookupPlace } = await import("../src/server/places.ts");
  const person = async (url: string) => {
    if (url.includes("list=search")) return { query: { search: [{ title: "Ramiro Corrales" }] } };
    if (url.includes("/page/summary/")) return { type: "standard", title: "Ramiro Corrales", extract: "Ramiro Corrales is a retired American soccer player.", thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/a/ab/R.jpg" } };
    throw new Error("geocoding is skipped in strict mode");
  };
  const loose = await lookupPlace("Cervejaria Ramiro", "Lisbon", {}, person).catch(() => undefined);
  assert.ok(loose, "non-strict lookups still return");
  const strict = await lookupPlace("Cervejaria Ramiro", "Lisbon", { strict: true }, person);
  assert.equal(strict.thumbnail, undefined, "no photo of a namesake");
  assert.equal(strict.extract, undefined);
});

test("receipts: members only, type-checked by content, attached to expenses", async () => {
  const { uploadReceipt, getReceipt } = await import("../src/server/receipts.ts");
  const { sniffMime } = await import("../src/server/files.ts");
  const owner = await signup({ email: "rcpt@example.com", password: "receipts are fun", name: "Rhi" });
  const stranger = await signup({ email: "nope@example.com", password: "not on this trip", name: "No" });
  const { trip } = await createTrip(owner.id, curateTrip(req));
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 0, 255, 128]);
  assert.equal(sniffMime(jpeg), "image/jpeg");
  assert.equal(sniffMime(new TextEncoder().encode("<svg onload=alert(1)>")), undefined);
  assert.equal(sniffMime(new TextEncoder().encode("%PDF-1.7\n")), "application/pdf");

  const { id } = await uploadReceipt(trip.id, owner.id, { bytes: jpeg, mime: "image/jpeg", name: "dinner.jpg" });
  await assert.rejects(uploadReceipt(trip.id, stranger.id, { bytes: jpeg, mime: "image/jpeg", name: "x.jpg" }), status(403));
  await assert.rejects(getReceipt(trip.id, stranger.id, id), status(403));
  const back = await getReceipt(trip.id, owner.id, id);
  assert.deepEqual([...back.bytes], [...jpeg], "bytes round-trip exactly");

  const e = await addExpense(trip.id, owner.id, { paidBy: owner.id, amount: 42, currency: "CAD", description: "Dinner", splitBetween: [owner.id], receiptId: id }, { CAD: 1.4 } as never);
  const bundle = await getTripBundle(trip.id, owner.id);
  assert.deepEqual(bundle.expenses.find((x) => x.id === e.id)?.receiptIds, [id]);
});
