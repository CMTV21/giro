import "server-only";
import { getDb } from "./db.ts";

/**
 * Read-through cache for provider calls. Fresh answers (including "nothing found") are reused for
 * `maxAgeMinutes`; if the provider fails, a stale answer is better than none.
 */
export async function cached<T>(key: string, maxAgeMinutes: number, load: () => Promise<T | undefined>): Promise<T | undefined> {
  const db = await getDb();
  const k = key.slice(0, 300);
  const [row] = await db.query<{ data: unknown; age: number }>("select data, extract(epoch from now() - fetched_at) / 60 as age from api_cache where key = $1", [k]);
  const stale = row?.data == null ? undefined : ((typeof row.data === "string" ? JSON.parse(row.data) : row.data) as T);
  if (row && Number(row.age) < maxAgeMinutes) return stale;
  try {
    const fresh = await load();
    await db.query("insert into api_cache (key, data) values ($1, $2::jsonb) on conflict (key) do update set data = excluded.data, fetched_at = now()", [k, fresh === undefined ? null : JSON.stringify(fresh)]);
    return fresh;
  } catch (err) {
    console.error(`provider call failed (${k.split("|")[0]})`, err instanceof Error ? err.message : err);
    return stale;
  }
}

/**
 * Claims one call against a provider's monthly budget. Returns false (and counts nothing) once
 * `cap` calls have been made this UTC month. The check and increment are one statement, so
 * concurrent requests can't overshoot.
 */
export async function takeMonthlyQuota(provider: string, cap: number): Promise<boolean> {
  if (!(cap > 0)) return false;
  const db = await getDb();
  const month = new Date().toISOString().slice(0, 7);
  const rows = await db.query(
    `insert into api_usage (provider, month, calls) values ($1, $2, 1)
     on conflict (provider, month) do update set calls = api_usage.calls + 1 where api_usage.calls < $3
     returning calls`,
    [provider, month, cap],
  );
  return rows.length > 0;
}
