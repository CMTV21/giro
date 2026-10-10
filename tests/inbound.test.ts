import assert from "node:assert/strict";
import { before, test } from "node:test";
import { curateTrip } from "../src/lib/curate.ts";
import type { ExtractedBookingLike } from "../src/lib/bookings.ts";
import type { TripRequest } from "../src/lib/types.ts";
import { outbox } from "../src/server/email.ts";
import { describe, handleInbound, htmlToText, listInbox, parseEmail, resolveInboxItem, signInbound, tokenFromAddress, verifyInbound } from "../src/server/inbound.ts";
import { tripLink } from "../src/server/links.ts";
import { createTrip, getTripBundle } from "../src/server/trips.ts";
import { signup } from "../src/server/users.ts";

process.env.INBOUND_SECRET = "test-secret-0123456789";
process.env.INBOUND_ADDRESS = "trips@girotrips.com";

const req: TripRequest = {
  destinations: ["Lisbon"], origin: "Toronto", startDate: "2026-05-10", endDate: "2026-05-14",
  adults: 2, children: 0, budgetTier: "comfort", pace: "balanced", interests: ["food"], stayType: "hotel",
};

const mime = (from: string, subject: string, body: string, pdf?: string) => {
  const b = "XYZBOUNDARY";
  const parts = [
    `From: ${from}\r\nTo: trips@girotrips.com\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${b}"\r\n\r\n`,
    `--${b}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${body}\r\n`,
  ];
  if (pdf) parts.push(`--${b}\r\nContent-Type: application/pdf; name="ticket.pdf"\r\nContent-Disposition: attachment; filename="ticket.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(pdf).toString("base64")}\r\n`);
  parts.push(`--${b}--\r\n`);
  return new TextEncoder().encode(parts.join(""));
};

const flight: ExtractedBookingLike = {
  flights: [{ airline: "Air Canada", flightNumber: "AC1906", from: "YYZ", to: "LIS", departDate: "2026-05-09", departTime: "21:30", arriveDate: "2026-05-10", arriveTime: "09:40", confirmation: "ABC123" }],
  stays: [],
  flightsTotal: 1840,
  flightsCurrency: "CAD",
};

let owner: Awaited<ReturnType<typeof signup>>;
let tripId: string;
let address: string;

before(async () => {
  owner = await signup({ email: "inbound-owner@example.com", password: "a long enough password", name: "Ola" });
  tripId = (await createTrip(owner.id, curateTrip(req))).trip.id;
  address = `trips+${await tripLink(tripId, owner.id, "inbox")}@girotrips.com`;
});

const signed = (raw: Uint8Array, to: string, from: string, ts = Math.floor(Date.now() / 1000).toString()) =>
  new Headers({ "x-giro-timestamp": ts, "x-giro-to": to, "x-giro-from": from, "x-giro-signature": signInbound(process.env.INBOUND_SECRET!, ts, to, from, raw) });

test("signatures: valid, tampered, stale and missing are told apart", () => {
  const raw = new TextEncoder().encode("hello");
  assert.deepEqual(verifyInbound(signed(raw, "a+1@x.com", "b@y.com"), raw), { to: "a+1@x.com", from: "b@y.com" });
  assert.equal(verifyInbound(signed(raw, "a+1@x.com", "b@y.com"), new TextEncoder().encode("hellO")), undefined, "body changed");
  const h = signed(raw, "a+1@x.com", "b@y.com");
  h.set("x-giro-to", "a+2@x.com");
  assert.equal(verifyInbound(h, raw), undefined, "recipient changed");
  assert.equal(verifyInbound(signed(raw, "a+1@x.com", "b@y.com", String(Math.floor(Date.now() / 1000) - 900)), raw), undefined, "too old");
  assert.equal(verifyInbound(new Headers(), raw), undefined);
});

test("addresses, html and MIME parsing", async () => {
  assert.equal(tokenFromAddress("Trips+0123456789ABCDEF0123456789abcdef@girotrips.com"), "0123456789abcdef0123456789abcdef");
  assert.equal(tokenFromAddress("trips@girotrips.com"), undefined);
  assert.equal(htmlToText("<style>p{}</style><table><tr><td>Flight</td><td>AC&nbsp;1906</td></tr></table><p>Total &amp; fees: &#36;1,840</p>"), "Flight AC 1906\nTotal & fees: $1,840");
  const parsed = await parseEmail(mime("Ola <inbound-owner@example.com>", "Your booking", "<p>Booking ref <b>ABC123</b></p>", "%PDF-1.4 fake ticket"));
  assert.equal(parsed.subject, "Your booking");
  assert.equal(parsed.from, "inbound-owner@example.com");
  assert.match(parsed.text, /Booking ref ABC123/);
  assert.equal(parsed.files.length, 1);
  assert.equal(parsed.files[0].mime, "application/pdf");
  assert.equal(describe(flight), "Air Canada AC1906 YYZ → LIS");
});

test("a member's forwarded confirmation is added at once, with a reply", async () => {
  const sent = outbox.length;
  const r = await handleInbound(mime("inbound-owner@example.com", "Air Canada booking", "<p>AC1906</p>"), { to: address, from: "Inbound-Owner@Example.com" }, { read: async () => flight, ai: true });
  assert.equal(r.status, "applied");
  assert.match(r.summary!, /1 flight/);
  const { trip } = await getTripBundle(tripId, owner.id);
  const f = trip.flights?.find((x) => x.flightNumber === "AC1906");
  assert.ok(f, "flight saved on the trip");
  assert.equal(f!.kind, "outbound");
  assert.equal(f!.paid?.currency, "CAD");
  assert.equal(outbox.length, sent + 1);
  assert.match(outbox.at(-1)!.subject, /^Added to /);
  // The same email again adds nothing new.
  const again = await handleInbound(mime("inbound-owner@example.com", "Air Canada booking", "<p>AC1906</p>"), { to: address, from: "inbound-owner@example.com" }, { read: async () => flight, ai: true });
  assert.equal(again.status, "empty");
});

test("mail from anyone else waits for a member; they can add or dismiss it", async () => {
  const stay: ExtractedBookingLike = { flights: [], stays: [{ name: "Memmo Alfama", address: "", city: "Lisbon", checkInDate: "2026-05-10", checkOutDate: "2026-05-14", checkInTime: "15:00", checkOutTime: "11:00", confirmation: "", total: 900, currency: "EUR" }] };
  const r = await handleInbound(mime("someone@else.com", "Hotel", "<p>hi</p>"), { to: address, from: "someone@else.com" }, { read: async () => stay, ai: true });
  assert.equal(r.status, "pending");
  const items = await listInbox(tripId, owner.id);
  const held = items.find((i) => i.status === "pending")!;
  assert.equal(held.summary, "Memmo Alfama");
  assert.ok(!(await getTripBundle(tripId, owner.id)).trip.stays[0].booking, "not applied yet");
  assert.equal(await resolveInboxItem(tripId, owner.id, held.id, "apply"), "applied");
  assert.equal((await getTripBundle(tripId, owner.id)).trip.stays[0].booking?.name, "Memmo Alfama");

  const r2 = await handleInbound(mime("spam@else.com", "Hi", "<p>x</p>"), { to: address, from: "spam@else.com" }, { read: async () => stay, ai: true });
  assert.equal(r2.status, "pending");
  const second = (await listInbox(tripId, owner.id)).find((i) => i.status === "pending")!;
  assert.equal(await resolveInboxItem(tripId, owner.id, second.id, "dismiss"), "dismissed");
});

test("unknown or replaced addresses are refused; non-bookings recorded as empty", async () => {
  assert.equal((await handleInbound(mime("x@y.com", "s", "b"), { to: "trips+0123456789abcdef0123456789abcdef@girotrips.com", from: "x@y.com" })).status, "unknown_address");
  const r = await handleInbound(mime("inbound-owner@example.com", "Lunch?", "<p>hi</p>"), { to: address, from: "inbound-owner@example.com" }, { read: async () => ({ flights: [], stays: [] }), ai: true });
  assert.equal(r.status, "empty");
  const fresh = `trips+${await tripLink(tripId, owner.id, "inbox", { rotate: true })}@girotrips.com`;
  assert.equal((await handleInbound(mime("x@y.com", "s", "b"), { to: address, from: "x@y.com" })).status, "unknown_address", "old address off");
  assert.equal((await handleInbound(mime("x@y.com", "s", "b"), { to: fresh, from: "x@y.com" }, { ai: false })).status, "failed", "no AI configured");
});

test("the Cloudflare worker's signature verifies on the server; it bounces what Giro refuses", async () => {
  const worker = (await import("../workers/inbound-email/worker.js")).default as { email: (m: unknown, env: unknown) => Promise<void> };
  const raw = mime("Ola@Example.com", "Booking", "<p>x</p>");
  const realFetch = globalThis.fetch;
  let captured: { headers: Headers; body: Uint8Array } | undefined;
  let reply = 200;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    captured = { headers: new Headers(init.headers), body: init.body as Uint8Array };
    return new Response("{}", { status: reply });
  }) as typeof fetch;
  const rejects: string[] = [];
  const message = (to: string) => ({ to, from: "Ola@Example.com", rawSize: raw.length, raw: new Blob([raw]).stream(), setReject: (r: string) => rejects.push(r) });
  const env = { INBOUND_URL: "https://girotrips.com/api/inbound", INBOUND_SECRET: process.env.INBOUND_SECRET };
  try {
    await worker.email(message("Trips+0123456789abcdef0123456789abcdef@girotrips.com"), env);
    assert.ok(captured);
    assert.deepEqual(verifyInbound(captured!.headers, captured!.body), { to: "trips+0123456789abcdef0123456789abcdef@girotrips.com", from: "ola@example.com" });
    reply = 404;
    await worker.email(message("trips+0123456789abcdef0123456789abcdef@girotrips.com"), env);
    await worker.email(message("hello@girotrips.com"), env);
    assert.equal(rejects.length, 2);
    assert.match(rejects[0], /isn't active/);
    assert.match(rejects[1], /Unknown address/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
