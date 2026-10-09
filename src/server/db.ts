import "server-only";
import { MIGRATIONS } from "./schema.ts";

/**
 * Minimal database layer: parameterised SQL over Postgres.
 *
 * - Production: set DATABASE_URL (Neon, Supabase, RDS, Railway…); uses postgres.js.
 * - Development/tests: embedded PGlite (real Postgres compiled to WASM), persisted in .data/
 *   or in memory when PGLITE_DIR=memory://.
 */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Run statements atomically. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

let instance: Promise<Db> | undefined;

export function getDb(): Promise<Db> {
  instance ??= connect().then(async (db) => {
    await migrate(db);
    return db;
  });
  return instance;
}

/** Tests only: start from a fresh in-memory database. */
export function resetDbForTests() {
  instance = undefined;
}

type Runner = { query: <T>(text: string, params: unknown[]) => Promise<T[]> };

/** A Db bound to an open transaction: nested tx() calls join it rather than opening another. */
function inTx(runner: Runner): Db {
  const db: Db = { query: (text, params = []) => runner.query(text, params), tx: (fn) => fn(db) };
  return db;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { max: 5, idle_timeout: 20, prepare: false });
    const run = (s: { unsafe: (q: string, p: never[]) => Promise<unknown> }): Runner => ({
      query: async <T,>(text: string, params: unknown[]) => (await s.unsafe(text, params as never[])) as T[],
    });
    return {
      query: (text, params = []) => run(sql).query(text, params),
      tx: (fn) => sql.begin((t) => fn(inTx(run(t)))) as never,
    };
  }
  if (process.env.VERCEL) {
    // Serverless functions have no persistent disk, so the embedded database would lose data.
    throw new Error("DATABASE_URL is not set. Add your Neon connection string in Vercel → Settings → Environment Variables, then redeploy.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  const pg = dir === "memory://" ? new PGlite() : new PGlite(dir);
  const run = (q: { query: <T>(text: string, params?: unknown[]) => Promise<{ rows: T[] }> }): Runner => ({
    query: async <T,>(text: string, params: unknown[]) => (await q.query<T>(text, params)).rows,
  });
  return {
    query: (text, params = []) => run(pg).query(text, params),
    tx: (fn) => pg.transaction((t) => fn(inTx(run(t)))),
  };
}

/** Apply pending migrations in one transaction, serialised across instances by an advisory lock. */
async function migrate(db: Db) {
  await db.tx(async (t) => {
    await t.query("select pg_advisory_xact_lock(727001)");
    await t.query("create table if not exists schema_migrations (version integer primary key, applied_at timestamptz not null default now())");
    const done = new Set((await t.query<{ version: number }>("select version from schema_migrations")).map((r) => Number(r.version)));
    for (const [i, statements] of MIGRATIONS.entries()) {
      const version = i + 1;
      if (done.has(version)) continue;
      for (const s of statements) await t.query(s);
      await t.query("insert into schema_migrations (version) values ($1)", [version]);
    }
  });
}
