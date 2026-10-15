import "server-only";
import { PASS_PRICE_CAD } from "../lib/pass.ts";
import { getDb } from "./db.ts";

/**
 * Launch-experiment measurement (docs/LAUNCH-90-DAY.md): anonymous funnel events, the Group Trip
 * Pass waitlist, and the go/no-go scorecard.
 */

export type FunnelKind = "planned" | "pass_viewed" | "pass_waitlist" | "pass_paid";

const tripIdOk = (id?: string) => (id && /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : null);

export async function recordEvent(kind: FunnelKind, tripId?: string, detail?: Record<string, unknown>): Promise<void> {
  try {
    const db = await getDb();
    await db.query("insert into funnel_events (kind, trip_id, detail) values ($1, $2, $3::jsonb)", [kind, tripIdOk(tripId), detail ? JSON.stringify(detail).slice(0, 2000) : null]);
  } catch (err) {
    // Measurement must never break planning.
    console.error("funnel event failed", err instanceof Error ? err.message : err);
  }
}

/** Joins the Pass waitlist. Returns false when the email was already on it (nothing changes). */
export async function joinWaitlist(input: { email: string; userId?: string; tripId?: string }): Promise<boolean> {
  const db = await getDb();
  const email = input.email.trim().toLowerCase();
  const rows = await db.query(
    "insert into pass_waitlist (email, user_id, trip_id, price_cad) values ($1, $2, $3, $4) on conflict (email) do nothing returning email",
    [email, input.userId ?? null, tripIdOk(input.tripId), PASS_PRICE_CAD],
  );
  if (rows.length) await recordEvent("pass_waitlist", input.tripId, { price: PASS_PRICE_CAD });
  return rows.length > 0;
}

export type Verdict = "go" | "iterate" | "stop";

export interface Metric {
  key: string;
  label: string;
  definition: string;
  value: number;
  /** Shown as a percentage when true. */
  ratio: boolean;
  /** At or above `go` is Go; below `stop` is Stop. */
  go: number;
  stop: number;
  verdict: Verdict;
  /** Too little data to judge yet (fewer than 20 in the denominator). */
  early: boolean;
}

export const grade = (value: number, go: number, stop: number): Verdict => (value >= go ? "go" : value < stop ? "stop" : "iterate");

/**
 * The plan's decision rule: Go needs at least 4 of 6 metrics at Go and none at Stop. Stop is for
 * when the group thesis fails (invite rate and Pass numbers both at Stop); anything else iterates.
 */
export function decide(metrics: Metric[]): Verdict {
  const v = (key: string) => metrics.find((m) => m.key === key)?.verdict;
  const passStop = v("pass_intent") === "stop" && v("passes_sold") === "stop";
  if (v("invite_rate") === "stop" && passStop) return "stop";
  if (metrics.some((m) => m.verdict === "stop")) return "iterate";
  return metrics.filter((m) => m.verdict === "go").length >= 4 ? "go" : "iterate";
}

const num = (v: unknown) => Number(v) || 0;
const share = (a: number, b: number) => (b > 0 ? a / b : 0);

export interface Scorecard {
  since: string;
  counts: { planned: number; saved: number; groupTrips: number; invites: number; joined: number; clickedTrips: number; passViews: number; waitlist: number; paid: number };
  metrics: Metric[];
  decision: Verdict;
}

export async function launchScorecard(since: string): Promise<Scorecard> {
  const db = await getDb();
  const [row] = await db.query<Record<string, unknown>>(
    `with saved as (select id from trips where created_at >= $1::date),
          planned as (select distinct trip_id from funnel_events where kind = 'planned' and at >= $1::date and trip_id is not null),
          known as (select trip_id as id from planned union select id from saved)
     select
       (select count(*) from funnel_events where kind = 'planned' and at >= $1::date) as planned,
       (select count(*) from saved) as saved,
       (select count(*) from (select trip_id from trip_members where trip_id in (select id from saved) group by trip_id having count(*) >= 2) g) as group_trips,
       (select count(distinct trip_id) from trip_invites where trip_id in (select id from saved)) as invited_trips,
       (select count(*) from trip_invites where trip_id in (select id from saved)) as invites,
       (select count(*) from trip_members where role <> 'owner' and trip_id in (select id from saved)) as joined,
       (select count(distinct trip_id) from clicks where created_at >= $1::date and trip_id in (select id from known)) as clicked_trips,
       (select count(*) from known) as known_trips,
       (select count(*) from funnel_events where kind = 'pass_viewed' and at >= $1::date) as pass_views,
       (select count(*) from pass_waitlist where created_at >= $1::date) as waitlist,
       (select count(*) from funnel_events where kind = 'pass_paid' and at >= $1::date) as paid`,
    [since],
  );
  const counts = {
    planned: num(row.planned),
    saved: num(row.saved),
    groupTrips: num(row.group_trips),
    invites: num(row.invites),
    joined: num(row.joined),
    clickedTrips: num(row.clicked_trips),
    passViews: num(row.pass_views),
    waitlist: num(row.waitlist),
    paid: num(row.paid),
  };
  const knownTrips = num(row.known_trips);
  const metric = (key: string, label: string, definition: string, value: number, ratio: boolean, go: number, stop: number, base: number): Metric => ({
    key, label, definition, value, ratio, go, stop, verdict: grade(value, go, stop), early: base < 20,
  });
  const metrics = [
    metric("planned", "Trips planned", "Trips created in the planner, signed in or not", counts.planned, false, 1000, 300, 1000),
    metric("invite_rate", "Invite rate", "Saved trips with at least one invite", share(num(row.invited_trips), counts.saved), true, 0.25, 0.1, counts.saved),
    metric("acceptance", "Invite acceptance", "People who joined ÷ invites created (invite links can be reused)", share(counts.joined, counts.invites), true, 0.4, 0.2, counts.invites),
    metric("click_through", "Booking click-through", "Trips with at least one partner click", share(counts.clickedTrips, knownTrips), true, 0.2, 0.08, knownTrips),
    metric("pass_intent", "Pass intent", "Waitlist sign-ups ÷ group trips", share(counts.waitlist, counts.groupTrips), true, 0.1, 0.04, counts.groupTrips),
    metric("passes_sold", "Passes sold", "Paid passes (payments start in week 9)", counts.paid, false, 30, 10, 30),
  ];
  return { since, counts, metrics, decision: decide(metrics) };
}
