import "server-only";
import { AFFILIATES, expectedCommission, hostAllowed, programFor, type AffiliateProgram } from "../lib/affiliates.ts";
import { newId } from "./auth.ts";
import { getDb } from "./db.ts";

export interface ClickInput {
  url: string;
  provider: string;
  kind: string;
  tripId?: string;
  valueUSD?: number;
  userId?: string;
}

/** Validate an outbound partner URL; only allow-listed https hosts may be redirected to. */
export function safePartnerUrl(raw: string): URL | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    return hostAllowed(url.hostname) ? url : undefined;
  } catch {
    return undefined;
  }
}

/** Record a click and return the final URL (with a per-click sub-ID where the program supports one). */
export async function recordClick(input: ClickInput): Promise<string | undefined> {
  const url = safePartnerUrl(input.url);
  if (!url) return undefined;
  // Attribute by the URL's host; the claimed provider only disambiguates hosts shared by programs.
  const owns = (p: AffiliateProgram) => p.hosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  const claimed = programFor(input.provider);
  const program = claimed && owns(claimed) ? claimed : AFFILIATES.find(owns);
  const provider = program?.provider ?? "Other";
  const id = newId();
  if (program?.subIdParam) url.searchParams.set(program.subIdParam, `giro-${id}`);
  const value = Math.max(0, Math.min(1_000_000, Number(input.valueUSD) || 0));
  try {
    const db = await getDb();
    await db.query(
      "insert into clicks (id, user_id, trip_id, provider, kind, value_usd, expected_commission_usd) values ($1, $2, $3, $4, $5, $6, $7)",
      [id, input.userId ?? null, input.tripId?.slice(0, 40) ?? null, provider, input.kind.slice(0, 20), value, expectedCommission(provider, value)],
    );
  } catch (err) {
    // Never block a traveller's booking because analytics failed.
    console.error("click logging failed", err);
  }
  return url.toString();
}

export interface RevenueRow {
  provider: string;
  clicks: number;
  valueUSD: number;
  expectedUSD: number;
}

export async function revenueReport(days = 30): Promise<{ rows: RevenueRow[]; daily: { day: string; clicks: number; expectedUSD: number }[] }> {
  const db = await getDb();
  const rows = await db.query<{ provider: string; clicks: number; value: string; expected: string }>(
    `select provider, count(*)::int as clicks, coalesce(sum(value_usd), 0) as value, coalesce(sum(expected_commission_usd), 0) as expected
       from clicks where created_at > now() - ($1 || ' days')::interval
      group by provider order by expected desc, clicks desc`,
    [String(days)],
  );
  const daily = await db.query<{ day: string; clicks: number; expected: string }>(
    `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int as clicks, coalesce(sum(expected_commission_usd), 0) as expected
       from clicks where created_at > now() - ($1 || ' days')::interval
      group by 1 order by 1`,
    [String(days)],
  );
  return {
    rows: rows.map((r) => ({ provider: r.provider, clicks: Number(r.clicks), valueUSD: Number(r.value), expectedUSD: Number(r.expected) })),
    daily: daily.map((d) => ({ day: d.day, clicks: Number(d.clicks), expectedUSD: Number(d.expected) })),
  };
}
