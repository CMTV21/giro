import "server-only";
import { randomBytes } from "node:crypto";
import { FALLBACK_RATES, isCurrency, type Currency } from "../lib/currency.ts";
import { balances, settleUp, type Transfer } from "../lib/split.ts";
import { parseTrip } from "../lib/trip-schema.ts";
import type { Trip } from "../lib/types.ts";
import { newId, sha256 } from "./auth.ts";
import { getDb, type Db } from "./db.ts";
import { forbidden, HttpError, notFound } from "./errors.ts";

export type Role = "owner" | "editor" | "viewer";
const RANK: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };
const INVITE_DAYS = 14;

export interface Member {
  id: string;
  name: string;
  role: Role;
}

export interface VoteTally {
  up: number;
  down: number;
  mine: -1 | 0 | 1;
  /** Names of members who voted up, for the "who's in" tooltip. */
  upBy: string[];
}

export interface Expense {
  id: string;
  paidBy: string;
  amount: number;
  currency: Currency;
  amountUSD: number;
  description: string;
  splitBetween: string[];
  createdBy: string;
  createdAt: string;
}

export interface TripBundle {
  trip: Trip;
  version: number;
  role: Role;
  members: Member[];
  votes: Record<string, VoteTally>;
  expenses: Expense[];
  /** Net position per member in USD (positive = owed). */
  balancesUSD: Record<string, number>;
  settleUSD: Transfer[];
}

const json = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);

function validTrip(value: unknown): Trip {
  const trip = parseTrip(value);
  if (!trip) throw new HttpError(400, "invalid_trip", "That trip couldn't be saved because its data is malformed.");
  return trip;
}

export async function roleFor(db: Db, tripId: string, userId: string): Promise<Role | undefined> {
  const [row] = await db.query<{ role: Role }>(
    `select case when t.owner_id = $2 then 'owner' else m.role end as role
       from trips t left join trip_members m on m.trip_id = t.id and m.user_id = $2
      where t.id = $1 and (t.owner_id = $2 or m.user_id is not null)`,
    [tripId, userId],
  );
  return row?.role;
}

async function requireRole(db: Db, tripId: string, userId: string, min: Role): Promise<Role> {
  const role = await roleFor(db, tripId, userId);
  if (!role) {
    const [exists] = await db.query("select 1 from trips where id = $1", [tripId]);
    throw exists ? forbidden() : notFound("That trip");
  }
  if (RANK[role] < RANK[min]) throw forbidden(min === "owner" ? "Only the trip owner can do that." : "You have view-only access to this trip.");
  return role;
}

export interface TripSummary {
  trip: Trip;
  role: Role;
  version: number;
  memberCount: number;
}

export async function listTrips(userId: string): Promise<TripSummary[]> {
  const db = await getDb();
  const rows = await db.query<{ data: unknown; role: Role; version: number; members: number }>(
    `select t.data, case when t.owner_id = $1 then 'owner' else m.role end as role, t.version,
            (select count(*)::int from trip_members x where x.trip_id = t.id) as members
       from trips t left join trip_members m on m.trip_id = t.id and m.user_id = $1
      where t.owner_id = $1 or m.user_id is not null
      order by t.updated_at desc
      limit 200`,
    [userId],
  );
  return rows.map((r) => ({ trip: json(r.data) as Trip, role: r.role, version: Number(r.version), memberCount: Number(r.members) + 1 }));
}

/** Save a new trip (or import one from this browser). Ids owned by someone else get a fresh id. */
export async function createTrip(userId: string, input: unknown): Promise<{ trip: Trip; version: number }> {
  const db = await getDb();
  const trip = validTrip(input);
  return db.tx(async (t) => {
    const [existing] = await t.query<{ owner_id: string; version: number }>("select owner_id, version from trips where id = $1", [trip.id]);
    if (existing && existing.owner_id === userId) {
      const [row] = await t.query<{ version: number }>("update trips set data = $2::jsonb, version = version + 1, updated_at = now() where id = $1 returning version", [trip.id, JSON.stringify(trip)]);
      return { trip, version: Number(row.version) };
    }
    const saved = existing ? { ...trip, id: newId() } : trip;
    const [row] = await t.query<{ version: number }>("insert into trips (id, owner_id, data) values ($1, $2, $3::jsonb) returning version", [saved.id, userId, JSON.stringify(saved)]);
    return { trip: saved, version: Number(row.version) };
  });
}

export async function getTripBundle(tripId: string, userId: string): Promise<TripBundle> {
  const db = await getDb();
  const role = await requireRole(db, tripId, userId, "viewer");
  const [row] = await db.query<{ data: unknown; version: number }>("select data, version from trips where id = $1", [tripId]);
  const members = await db.query<Member>(
    `select u.id, u.name, 'owner' as role from trips t join users u on u.id = t.owner_id where t.id = $1
     union all
     select u.id, u.name, m.role from trip_members m join users u on u.id = m.user_id where m.trip_id = $1`,
    [tripId],
  );
  const voteRows = await db.query<{ activity_id: string; user_id: string; value: number; name: string }>(
    "select v.activity_id, v.user_id, v.value, u.name from votes v join users u on u.id = v.user_id where v.trip_id = $1",
    [tripId],
  );
  const votes: Record<string, VoteTally> = {};
  for (const v of voteRows) {
    const tally = (votes[v.activity_id] ??= { up: 0, down: 0, mine: 0, upBy: [] });
    if (Number(v.value) > 0) {
      tally.up++;
      tally.upBy.push(v.name);
    } else tally.down++;
    if (v.user_id === userId) tally.mine = Number(v.value) > 0 ? 1 : -1;
  }
  const expenses = await listExpenses(db, tripId);
  const net = balances(
    expenses.map((e) => ({ paidBy: e.paidBy, amount: e.amountUSD, splitBetween: e.splitBetween })),
    members.map((m) => m.id),
  );
  return { trip: json(row.data) as Trip, version: Number(row.version), role, members, votes, expenses, balancesUSD: net, settleUSD: settleUp(net) };
}

/** Optimistic concurrency: the save succeeds only if nobody else saved since `baseVersion`. */
export async function updateTrip(tripId: string, userId: string, input: unknown, baseVersion: number): Promise<{ version: number }> {
  const db = await getDb();
  await requireRole(db, tripId, userId, "editor");
  const trip = validTrip(input);
  if (trip.id !== tripId) throw new HttpError(400, "id_mismatch", "Trip id doesn't match.");
  const [row] = await db.query<{ version: number }>(
    "update trips set data = $2::jsonb, version = version + 1, updated_at = now() where id = $1 and version = $3 returning version",
    [tripId, JSON.stringify(trip), baseVersion],
  );
  if (!row) throw new HttpError(409, "conflict", "Someone else changed this trip. Reload to see their edits.");
  return { version: Number(row.version) };
}

export async function deleteOrLeaveTrip(tripId: string, userId: string): Promise<"deleted" | "left"> {
  const db = await getDb();
  const role = await requireRole(db, tripId, userId, "viewer");
  if (role === "owner") {
    await db.query("delete from trips where id = $1", [tripId]);
    return "deleted";
  }
  await db.query("delete from trip_members where trip_id = $1 and user_id = $2", [tripId, userId]);
  return "left";
}

export async function createInvite(tripId: string, userId: string, role: "editor" | "viewer"): Promise<string> {
  const db = await getDb();
  await requireRole(db, tripId, userId, "editor");
  const token = randomBytes(24).toString("base64url");
  await db.query("insert into trip_invites (token_hash, trip_id, role, created_by, expires_at) values ($1, $2, $3, $4, now() + ($5 || ' days')::interval)", [sha256(token), tripId, role, userId, String(INVITE_DAYS)]);
  return token;
}

export async function tripTitle(tripId: string): Promise<string> {
  const db = await getDb();
  const [row] = await db.query<{ data: unknown }>("select data from trips where id = $1", [tripId]);
  return row ? (json(row.data) as Trip).title : "a trip";
}

/** Join a trip from an invite link. Never downgrades an existing member. */
export async function acceptInvite(token: string, userId: string): Promise<{ tripId: string; title: string }> {
  const db = await getDb();
  const [invite] = await db.query<{ trip_id: string; role: "editor" | "viewer"; data: unknown; owner_id: string }>(
    `select i.trip_id, i.role, t.data, t.owner_id from trip_invites i join trips t on t.id = i.trip_id
      where i.token_hash = $1 and i.expires_at > now()`,
    [sha256(token)],
  );
  if (!invite) throw new HttpError(410, "invite_expired", "This invite link has expired or is invalid. Ask for a new one.");
  if (invite.owner_id !== userId) {
    await db.query(
      `insert into trip_members (trip_id, user_id, role) values ($1, $2, $3)
       on conflict (trip_id, user_id) do update set role = case when trip_members.role = 'viewer' then excluded.role else trip_members.role end`,
      [invite.trip_id, userId, invite.role],
    );
  }
  return { tripId: invite.trip_id, title: (json(invite.data) as Trip).title };
}

export async function removeMember(tripId: string, actorId: string, memberId: string): Promise<void> {
  const db = await getDb();
  if (actorId !== memberId) await requireRole(db, tripId, actorId, "owner");
  await db.query("delete from trip_members where trip_id = $1 and user_id = $2", [tripId, memberId]);
}

export async function setMemberRole(tripId: string, actorId: string, memberId: string, role: "editor" | "viewer"): Promise<void> {
  const db = await getDb();
  await requireRole(db, tripId, actorId, "owner");
  await db.query("update trip_members set role = $3 where trip_id = $1 and user_id = $2", [tripId, memberId, role]);
}

/** Every member, viewers included, gets a say in what makes the cut. */
export async function vote(tripId: string, userId: string, activityId: string, value: -1 | 0 | 1): Promise<void> {
  const db = await getDb();
  await requireRole(db, tripId, userId, "viewer");
  if (value === 0) {
    await db.query("delete from votes where trip_id = $1 and activity_id = $2 and user_id = $3", [tripId, activityId, userId]);
    return;
  }
  await db.query(
    "insert into votes (trip_id, activity_id, user_id, value) values ($1, $2, $3, $4) on conflict (trip_id, activity_id, user_id) do update set value = excluded.value",
    [tripId, activityId.slice(0, 40), userId, value],
  );
}

async function listExpenses(db: Db, tripId: string): Promise<Expense[]> {
  const rows = await db.query<{ id: string; paid_by: string; amount: string; currency: string; amount_usd: string; description: string; split_between: unknown; created_by: string; created_at: Date | string }>(
    "select * from expenses where trip_id = $1 order by created_at desc",
    [tripId],
  );
  return rows.map((r) => ({
    id: r.id,
    paidBy: r.paid_by,
    amount: Number(r.amount),
    currency: isCurrency(r.currency) ? r.currency : "USD",
    amountUSD: Number(r.amount_usd),
    description: r.description,
    splitBetween: json(r.split_between) as string[],
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export interface ExpenseInput {
  paidBy: string;
  amount: number;
  currency: Currency;
  description: string;
  splitBetween: string[];
}

export async function addExpense(tripId: string, userId: string, input: ExpenseInput, rates: Record<Currency, number> = FALLBACK_RATES): Promise<Expense> {
  const db = await getDb();
  await requireRole(db, tripId, userId, "viewer");
  const bundleMembers = await db.query<{ id: string }>(
    "select owner_id as id from trips where id = $1 union select user_id from trip_members where trip_id = $1",
    [tripId],
  );
  const ids = new Set(bundleMembers.map((m) => m.id));
  if (!ids.has(input.paidBy)) throw new HttpError(400, "not_member", "Whoever paid must be on the trip.");
  const among = [...new Set(input.splitBetween)].filter((m) => ids.has(m));
  if (!among.length) throw new HttpError(400, "no_split", "Choose who this expense is split between.");
  const amount = Math.round(input.amount * 100) / 100;
  const amountUSD = Math.round((amount / (rates[input.currency] || 1)) * 100) / 100;
  const id = newId();
  await db.query(
    "insert into expenses (id, trip_id, paid_by, amount, currency, amount_usd, description, split_between, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)",
    [id, tripId, input.paidBy, amount, input.currency, amountUSD, input.description.trim().slice(0, 120) || "Expense", JSON.stringify(among), userId],
  );
  return { id, paidBy: input.paidBy, amount, currency: input.currency, amountUSD, description: input.description.trim().slice(0, 120) || "Expense", splitBetween: among, createdBy: userId, createdAt: new Date().toISOString() };
}

export async function deleteExpense(tripId: string, userId: string, expenseId: string): Promise<void> {
  const db = await getDb();
  const role = await requireRole(db, tripId, userId, "viewer");
  const [row] = await db.query<{ created_by: string; paid_by: string }>("select created_by, paid_by from expenses where id = $1 and trip_id = $2", [expenseId, tripId]);
  if (!row) throw notFound("That expense");
  if (role !== "owner" && row.created_by !== userId && row.paid_by !== userId) throw forbidden("Only whoever logged or paid it (or the owner) can delete an expense.");
  await db.query("delete from expenses where id = $1", [expenseId]);
}
