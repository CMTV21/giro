import "server-only";
import { randomBytes } from "node:crypto";
import { parseTrip } from "../lib/trip-schema.ts";
import type { Trip } from "../lib/types.ts";
import { getDb } from "./db.ts";
import { requireRole } from "./trips.ts";

/**
 * Secret per-trip links. Anyone holding one can use it without signing in, so they're long and
 * random, shown only to members, and can be replaced (which turns the old one off).
 * - calendar: read-only feed any member may get.
 * - inbox: forwarding address that adds bookings; editors only.
 */
export type LinkPurpose = "calendar" | "inbox";

const MIN_ROLE = { calendar: "viewer", inbox: "editor" } as const;
const newToken = () => randomBytes(16).toString("hex");
export const isLinkToken = (s: string) => /^[0-9a-f]{32}$/.test(s);

export async function tripLink(tripId: string, userId: string, purpose: LinkPurpose, { rotate = false } = {}): Promise<string> {
  const db = await getDb();
  // Replacing a link switches it off for everyone using it, so only editors may.
  await requireRole(db, tripId, userId, rotate ? "editor" : MIN_ROLE[purpose]);
  if (!rotate) {
    const [row] = await db.query<{ token: string }>("select token from trip_links where trip_id = $1 and purpose = $2", [tripId, purpose]);
    if (row) return row.token;
  }
  const token = newToken();
  await db.query(
    `insert into trip_links (trip_id, purpose, token, created_by) values ($1, $2, $3, $4)
     on conflict (trip_id, purpose) do update set token = excluded.token, created_by = excluded.created_by, created_at = now()`,
    [tripId, purpose, token, userId],
  );
  return token;
}

/** The trip a link opens, or undefined for unknown or replaced links. */
export async function tripForLink(token: string, purpose: LinkPurpose): Promise<{ trip: Trip; createdBy: string } | undefined> {
  if (!isLinkToken(token)) return undefined;
  const db = await getDb();
  const [row] = await db.query<{ data: unknown; created_by: string }>(
    "select t.data, l.created_by from trip_links l join trips t on t.id = l.trip_id where l.token = $1 and l.purpose = $2",
    [token, purpose],
  );
  if (!row) return undefined;
  const trip = parseTrip(typeof row.data === "string" ? JSON.parse(row.data) : row.data);
  return trip ? { trip, createdBy: row.created_by } : undefined;
}
