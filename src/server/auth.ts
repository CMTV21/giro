import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { isCurrency, type Currency } from "../lib/currency.ts";
import { getDb } from "./db.ts";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

export const SESSION_COOKIE = "giro_session";
export const SESSION_DAYS = 30;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export interface User {
  id: string;
  email: string;
  name: string;
  homeCurrency: Currency;
  homeAirport: string;
  isAdmin: boolean;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  home_currency: string;
  home_airport: string;
}

export const newId = (bytes = 9) => randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const adminEmails = () =>
  new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    homeCurrency: isCurrency(row.home_currency) ? row.home_currency : "CAD",
    homeAirport: row.home_airport,
    isAdmin: adminEmails().has(row.email),
  };
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;

export function passwordProblem(pw: string): string | undefined {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 200) return "That password is too long.";
  if (/^(.)\1+$/.test(pw)) return "Choose a less predictable password.";
  return undefined;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize("NFKC"), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(pw.normalize("NFKC"), Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// A real hash to compare against when the email doesn't exist, so timing doesn't reveal accounts.
let dummyHash: Promise<string> | undefined;
export const dummyPasswordHash = () => (dummyHash ??= hashPassword("not-a-real-password-giro"));

/** Create a session and return the raw token for the cookie (only its hash is stored). */
export async function createSession(userId: string): Promise<{ token: string; expires: Date }> {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.query("insert into sessions (id, user_id, expires_at) values ($1, $2, $3)", [sha256(token), userId, expires.toISOString()]);
  // Opportunistic cleanup of expired sessions.
  await db.query("delete from sessions where expires_at < now()");
  return { token, expires };
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  const db = await getDb();
  await db.query("delete from sessions where id = $1", [sha256(token)]);
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export async function userFromToken(token: string | undefined): Promise<User | undefined> {
  if (!token) return undefined;
  const db = await getDb();
  const [row] = await db.query<UserRow>(
    `select u.id, u.email, u.name, u.home_currency, u.home_airport
       from sessions s join users u on u.id = s.user_id
      where s.id = $1 and s.expires_at > now()`,
    [sha256(token)],
  );
  return row ? toUser(row) : undefined;
}

export const currentUser = (request: Request) => userFromToken(readCookie(request, SESSION_COOKIE));

export const sessionCookie = (token: string, expires: Date) => ({
  name: SESSION_COOKIE,
  value: token,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

/**
 * CSRF defence for cookie-authenticated mutations: the request must come from our own origin.
 * Browsers send Sec-Fetch-Site and/or Origin on every cross-site POST/PUT/PATCH/DELETE.
 */
export function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Sliding-window limiter backed by the database, so it holds across server instances. */
export async function tooManyAttempts(key: string, max: number, windowMinutes: number): Promise<boolean> {
  const db = await getDb();
  await db.query("delete from auth_attempts where at < now() - interval '1 day'");
  const [{ n }] = await db.query<{ n: number }>(`select count(*)::int as n from auth_attempts where key = $1 and at > now() - ($2 || ' minutes')::interval`, [key, String(windowMinutes)]);
  if (Number(n) >= max) return true;
  await db.query("insert into auth_attempts (key) values ($1)", [key]);
  return false;
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
