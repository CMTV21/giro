import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import PostalMime from "postal-mime";
import { aiAvailable } from "../lib/ai.ts";
import { mergeBooking, type ExtractedBookingLike } from "../lib/bookings.ts";
import { isCurrency, isPayCurrency, FALLBACK_RATES } from "../lib/currency.ts";
import { recalcBudget } from "../lib/curate.ts";
import type { Paid, Trip } from "../lib/types.ts";
import { getRates } from "../lib/rates.server.ts";
import { newId, normalizeEmail, tooManyAttempts } from "./auth.ts";
import { getDb } from "./db.ts";
import { appUrl, escapeHtml, sendEmail } from "./email.ts";
import { readBookingEmail } from "./extract.ts";
import { sniffMime, type SafeMime } from "./files.ts";
import { tripForLink } from "./links.ts";
import { mutateTrip, requireRole, roleFor } from "./trips.ts";

/**
 * Bookings forwarded by email. A Cloudflare Email Worker receives mail for trips+<token>@<domain>
 * and posts the raw message here, signed with INBOUND_SECRET. Mail from a trip member (owner or
 * editor, by account email) is applied at once; anything else waits in the trip's inbox for a
 * member to add or dismiss, so a leaked address can't quietly change a trip.
 */

export const inboundAddressBase = () => process.env.INBOUND_ADDRESS?.trim().toLowerCase();
export const inboundConfigured = () => Boolean(process.env.INBOUND_SECRET?.trim() && /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(inboundAddressBase() ?? ""));

/** trips@girotrips.com + token → trips+token@girotrips.com */
export function inboxAddress(token: string): string | undefined {
  const base = inboundAddressBase();
  if (!base || !inboundConfigured()) return undefined;
  const [local, domain] = base.split("@");
  return `${local}+${token}@${domain}`;
}

export const tokenFromAddress = (to: string) => /\+([0-9a-f]{32})@/.exec(to.trim().toLowerCase())?.[1];

const MAX_SKEW_SECONDS = 300;

/** HMAC-SHA256 over "timestamp.to.from." followed by the raw message bytes, hex encoded. */
export function signInbound(secret: string, timestamp: string, to: string, from: string, raw: Uint8Array): string {
  return createHmac("sha256", secret).update(`${timestamp}.${to}.${from}.`).update(raw).digest("hex");
}

export function verifyInbound(headers: Headers, raw: Uint8Array, now = Date.now()): { to: string; from: string } | undefined {
  const secret = process.env.INBOUND_SECRET?.trim();
  const ts = headers.get("x-giro-timestamp") ?? "";
  const to = headers.get("x-giro-to") ?? "";
  const from = headers.get("x-giro-from") ?? "";
  const sig = headers.get("x-giro-signature") ?? "";
  if (!secret || !/^\d{10}$/.test(ts) || !/^[0-9a-f]{64}$/.test(sig) || !to) return undefined;
  if (Math.abs(now / 1000 - Number(ts)) > MAX_SKEW_SECONDS) return undefined;
  const expected = Buffer.from(signInbound(secret, ts, to, from, raw), "hex");
  const given = Buffer.from(sig, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given) ? { to, from } : undefined;
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

/** Readable text from an HTML email (layout tables become lines). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : " ";
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

const MAX_FILES = 3;
const MAX_FILE_BYTES = 3 * 1024 * 1024;
/** Inline logos and signatures are small; real attachments (tickets, PDFs) are bigger. */
const MIN_IMAGE_BYTES = 30 * 1024;

export interface ParsedEmail {
  subject: string;
  from: string;
  text: string;
  files: { mime: SafeMime; bytes: Uint8Array; name: string }[];
}

export async function parseEmail(raw: Uint8Array): Promise<ParsedEmail> {
  const email = await PostalMime.parse(raw);
  const files: ParsedEmail["files"] = [];
  for (const a of email.attachments ?? []) {
    if (files.length >= MAX_FILES) break;
    const bytes = typeof a.content === "string" ? new TextEncoder().encode(a.content) : new Uint8Array(a.content);
    const mime = sniffMime(bytes);
    if (!mime || bytes.length > MAX_FILE_BYTES) continue;
    if (mime !== "application/pdf" && bytes.length < MIN_IMAGE_BYTES) continue;
    files.push({ mime, bytes, name: a.filename ?? "attachment" });
  }
  const text = (email.text?.trim() || htmlToText(email.html ?? "")).replace(/\n{3,}/g, "\n\n");
  return { subject: (email.subject ?? "").slice(0, 300), from: email.from?.address ?? "", text, files };
}

/** A confirmation total as what was paid, at today's ECB rate; undefined when unclear. */
export async function serverPaid(total: number | undefined, currency: string | undefined): Promise<Paid | undefined> {
  const code = currency?.trim().toUpperCase();
  if (!total || !(total > 0) || !isPayCurrency(code)) return undefined;
  const amount = Math.round(total * 100) / 100;
  if (code === "USD") return { amount, currency: code, usd: amount };
  const t = await getRates();
  const rate = isCurrency(code) ? t.rates[code] ?? FALLBACK_RATES[code] : t.extra?.[code];
  return rate && rate > 0 ? { amount, currency: code, usd: Math.round((amount / rate) * 100) / 100 } : undefined;
}

type Status = "applied" | "pending" | "dismissed" | "empty" | "failed";

/** Owners and editors whose account email matches the sender. */
async function memberBySender(tripId: string, sender: string): Promise<{ id: string; name: string; email: string } | undefined> {
  if (!sender) return undefined;
  const db = await getDb();
  const [row] = await db.query<{ id: string; name: string; email: string }>(
    `select u.id, u.name, u.email from users u
      where u.email = $2 and (exists (select 1 from trips t where t.id = $1 and t.owner_id = u.id)
         or exists (select 1 from trip_members m where m.trip_id = $1 and m.user_id = u.id and m.role = 'editor'))`,
    [tripId, normalizeEmail(sender)],
  );
  return row;
}

/** Merge an extracted booking into the saved trip. Returns the summary, or undefined if nothing new. */
async function applyToTrip(tripId: string, found: ExtractedBookingLike): Promise<string | undefined> {
  return mutateTrip(tripId, async (trip: Trip) => {
    const merged = await mergeBooking(trip, found, serverPaid);
    return merged ? { trip: recalcBudget(merged.trip), result: merged.summary } : undefined;
  });
}

const isEmpty = (b: ExtractedBookingLike) => !(b.flights?.length || b.stays?.length);

export interface InboundResult {
  status: Status | "unknown_address" | "rate_limited";
  summary?: string;
}

export async function handleInbound(raw: Uint8Array, envelope: { to: string; from: string }, { read = readBookingEmail as (e: ParsedEmail) => Promise<ExtractedBookingLike>, ai = aiAvailable() } = {}): Promise<InboundResult> {
  const token = tokenFromAddress(envelope.to);
  const link = token ? await tripForLink(token, "inbox") : undefined;
  if (!link) return { status: "unknown_address" };
  const tripId = link.trip.id;
  // The address stops working if whoever made it can no longer edit the trip.
  const db = await getDb();
  const creatorRole = await roleFor(db, tripId, link.createdBy);
  if (creatorRole !== "owner" && creatorRole !== "editor") return { status: "unknown_address" };
  if (await tooManyAttempts(`inbound:${tripId}`, 40, 60 * 24)) return { status: "rate_limited" };

  const email = await parseEmail(raw);
  const sender = normalizeEmail(envelope.from || email.from);
  const member = await memberBySender(tripId, sender);
  const record = async (status: Status, summary = "", extracted?: ExtractedBookingLike) => {
    await db.query("insert into trip_inbox (id, trip_id, sender, subject, status, summary, extracted) values ($1, $2, $3, $4, $5, $6, $7::jsonb)", [
      newId(), tripId, sender.slice(0, 254), email.subject || "(no subject)", status, summary, extracted ? JSON.stringify(extracted) : null,
    ]);
    return { status, summary };
  };

  if (!ai) return record("failed", "Reading forwarded emails needs Giro AI, which isn't set up.");
  let found: ExtractedBookingLike;
  try {
    found = await read(email);
  } catch (err) {
    console.error("inbound read failed", err instanceof Error ? err.message : err);
    return record("failed", "We couldn't read this email.");
  }
  if (isEmpty(found)) {
    const r = await record("empty", "No flights or stays found in this email.");
    if (member) await notify(member, link.trip, email.subject, r);
    return r;
  }
  if (!member) return record("pending", describe(found), found);
  const summary = await applyToTrip(tripId, found);
  const r = summary ? await record("applied", `Added ${summary}.`, found) : await record("empty", "Already on your trip, or didn't match its dates.", found);
  await notify(member, link.trip, email.subject, r);
  return r;
}

/** "AC 1906 YYZ → LIS; Memmo Alfama" for the review list. */
export function describe(b: ExtractedBookingLike): string {
  const flights = (b.flights ?? []).map((f) => [f.airline, f.flightNumber, `${f.from} → ${f.to}`].filter(Boolean).join(" "));
  const stays = (b.stays ?? []).map((s) => s.name || `Stay in ${s.city}`);
  return [...flights, ...stays].join("; ").slice(0, 300);
}

/** A short reply to the member who forwarded it, so they know it worked (members only: no backscatter). */
async function notify(member: { email: string; name: string }, trip: Trip, subject: string, r: { status: Status; summary: string }) {
  const url = `${appUrl()}/trip/${trip.id}`;
  const ok = r.status === "applied";
  const line = ok ? `${r.summary} Times on your plan have been adjusted around them.` : r.summary;
  await sendEmail({
    to: member.email,
    subject: ok ? `Added to ${trip.title}` : `Nothing added to ${trip.title}`,
    html: `<p>Hi ${escapeHtml(member.name)},</p><p>About your forwarded email “${escapeHtml(subject || "(no subject)")}”: ${escapeHtml(line)}</p><p><a href="${escapeHtml(url)}">Open ${escapeHtml(trip.title)}</a> to check the details.</p>`,
    text: `Hi ${member.name},\n\nAbout your forwarded email "${subject || "(no subject)"}": ${line}\n\nCheck the details: ${url}`,
  }).catch((e) => console.error("inbound notify failed", e));
}

export interface InboxItem {
  id: string;
  sender: string;
  subject: string;
  status: Status;
  summary: string;
  createdAt: string;
}

export async function listInbox(tripId: string, userId: string): Promise<InboxItem[]> {
  const db = await getDb();
  await requireRole(db, tripId, userId, "viewer");
  const rows = await db.query<{ id: string; sender: string; subject: string; status: Status; summary: string; created_at: string | Date }>(
    "select id, sender, subject, status, summary, created_at from trip_inbox where trip_id = $1 order by created_at desc limit 20",
    [tripId],
  );
  return rows.map((r) => ({ id: r.id, sender: r.sender, subject: r.subject, status: r.status, summary: r.summary, createdAt: new Date(r.created_at).toISOString() }));
}

/** A member adds or dismisses a held email. */
export async function resolveInboxItem(tripId: string, userId: string, itemId: string, action: "apply" | "dismiss"): Promise<InboxItem["status"]> {
  const db = await getDb();
  await requireRole(db, tripId, userId, "editor");
  const [item] = await db.query<{ status: Status; extracted: unknown }>("select status, extracted from trip_inbox where id = $1 and trip_id = $2", [itemId, tripId]);
  if (!item || item.status !== "pending") return item?.status ?? "dismissed";
  if (action === "dismiss") {
    await db.query("update trip_inbox set status = 'dismissed' where id = $1", [itemId]);
    return "dismissed";
  }
  const found = (typeof item.extracted === "string" ? JSON.parse(item.extracted) : item.extracted) as ExtractedBookingLike;
  const summary = await applyToTrip(tripId, found);
  const status: Status = summary ? "applied" : "empty";
  await db.query("update trip_inbox set status = $2, summary = $3 where id = $1", [itemId, status, summary ? `Added ${summary}.` : "Already on your trip, or didn't match its dates."]);
  return status;
}
