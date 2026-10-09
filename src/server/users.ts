import "server-only";
import { randomBytes } from "node:crypto";
import { isCurrency, type Currency } from "../lib/currency.ts";
import { parseTaste, type TasteProfile } from "../lib/taste.ts";
import { dummyPasswordHash, hashPassword, newId, normalizeEmail, passwordProblem, sha256, toUser, tooManyAttempts, validEmail, verifyPassword, type User } from "./auth.ts";
import { getDb } from "./db.ts";
import { appUrl, resetEmail, sendEmail, verifyEmail, type EmailResult } from "./email.ts";
import { HttpError } from "./errors.ts";

interface Row {
  id: string;
  email: string;
  name: string;
  home_currency: string;
  home_airport: string;
  email_verified_at?: Date | string | null;
  password_hash: string;
}

export async function signup(input: { email: string; password: string; name: string; homeCurrency?: string }): Promise<User> {
  const email = normalizeEmail(input.email);
  if (!validEmail(email)) throw new HttpError(400, "invalid_email", "Enter a valid email address.");
  const problem = passwordProblem(input.password);
  if (problem) throw new HttpError(400, "weak_password", problem);
  const name = input.name.trim().slice(0, 80) || email.split("@")[0];
  const currency: Currency = isCurrency(input.homeCurrency) ? input.homeCurrency : "CAD";
  const db = await getDb();
  const hash = await hashPassword(input.password);
  const rows = await db.query<Row>(
    `insert into users (id, email, name, password_hash, home_currency) values ($1, $2, $3, $4, $5)
     on conflict (email) do nothing
     returning id, email, name, home_currency, home_airport, email_verified_at, password_hash`,
    [newId(), email, name, hash, currency],
  );
  if (!rows[0]) throw new HttpError(409, "email_taken", "An account with this email already exists. Try signing in.");
  return toUser(rows[0]);
}

export async function login(input: { email: string; password: string }, ip: string): Promise<User> {
  const email = normalizeEmail(input.email);
  if ((await tooManyAttempts(`login:${email}`, 10, 15)) || (await tooManyAttempts(`ip:${ip}`, 60, 15))) {
    throw new HttpError(429, "too_many_attempts", "Too many sign-in attempts. Please wait 15 minutes and try again.");
  }
  const db = await getDb();
  const [row] = await db.query<Row>("select id, email, name, home_currency, home_airport, email_verified_at, password_hash from users where email = $1", [email]);
  const valid = await verifyPassword(input.password, row?.password_hash ?? (await dummyPasswordHash()));
  if (!row || !valid) throw new HttpError(401, "bad_credentials", "Email or password is incorrect.");
  await db.query("delete from auth_attempts where key = $1", [`login:${email}`]);
  return toUser(row);
}

export async function updateProfile(userId: string, patch: { name?: string; homeCurrency?: string; homeAirport?: string }): Promise<User> {
  const db = await getDb();
  const [row] = await db.query<Row>(
    `update users set
       name = coalesce($2, name),
       home_currency = coalesce($3, home_currency),
       home_airport = coalesce($4, home_airport)
     where id = $1
     returning id, email, name, home_currency, home_airport, email_verified_at, password_hash`,
    [
      userId,
      patch.name?.trim() ? patch.name.trim().slice(0, 80) : null,
      isCurrency(patch.homeCurrency) ? patch.homeCurrency : null,
      typeof patch.homeAirport === "string" ? patch.homeAirport.trim().slice(0, 60) : null,
    ],
  );
  if (!row) throw new HttpError(404, "not_found", "Account not found.");
  return toUser(row);
}

export async function getTaste(userId: string): Promise<TasteProfile | undefined> {
  const db = await getDb();
  const [row] = await db.query<{ taste: unknown }>("select taste from users where id = $1", [userId]);
  return parseTaste(typeof row?.taste === "string" ? JSON.parse(row.taste) : row?.taste);
}

export async function setTaste(userId: string, profile: TasteProfile): Promise<void> {
  const db = await getDb();
  await db.query("update users set taste = $2::jsonb where id = $1", [userId, JSON.stringify(profile)]);
}

/** Delete the account and everything it owns (trips it owns, memberships, sessions). */
export async function deleteAccount(userId: string): Promise<void> {
  const db = await getDb();
  await db.query("delete from users where id = $1", [userId]);
}

// ---- single-use tokens: password reset & email verification ---------------------------------

type TokenPurpose = "reset" | "verify";
const TOKEN_TTL_MINUTES: Record<TokenPurpose, number> = { reset: 60, verify: 7 * 24 * 60 };

/** Issue a token (only its hash is stored); earlier unused tokens for the same purpose are revoked. */
export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  await db.tx(async (t) => {
    await t.query("delete from auth_tokens where user_id = $1 and purpose = $2 and used_at is null", [userId, purpose]);
    await t.query("insert into auth_tokens (token_hash, user_id, purpose, expires_at) values ($1, $2, $3, now() + ($4 || ' minutes')::interval)", [sha256(token), userId, purpose, String(TOKEN_TTL_MINUTES[purpose])]);
  });
  return token;
}

/** Atomically mark a token used and return its user, or fail if it's unknown, used or expired. */
async function consumeToken(token: string, purpose: TokenPurpose): Promise<string> {
  const db = await getDb();
  const [row] = await db.query<{ user_id: string }>(
    "update auth_tokens set used_at = now() where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now() returning user_id",
    [sha256(token), purpose],
  );
  if (!row) throw new HttpError(410, "link_expired", purpose === "reset" ? "This reset link has expired or was already used. Request a new one." : "This confirmation link has expired or was already used.");
  return row.user_id;
}

/** Always succeeds from the caller's view, so it can't be used to discover which emails have accounts. */
export async function requestPasswordReset(rawEmail: string, ip: string): Promise<EmailResult | undefined> {
  const email = normalizeEmail(rawEmail);
  if (!validEmail(email)) return undefined;
  if ((await tooManyAttempts(`reset:${email}`, 5, 60)) || (await tooManyAttempts(`reset-ip:${ip}`, 20, 60))) return undefined;
  const db = await getDb();
  const [row] = await db.query<{ id: string }>("select id from users where email = $1", [email]);
  if (!row) return undefined;
  const token = await issueToken(row.id, "reset");
  const mail = resetEmail(`${appUrl()}/reset/${token}`);
  return sendEmail({ to: email, ...mail });
}

/** Set a new password from a reset link; signs out every existing session. */
export async function resetPassword(token: string, password: string): Promise<User> {
  const problem = passwordProblem(password);
  if (problem) throw new HttpError(400, "weak_password", problem);
  const userId = await consumeToken(token, "reset");
  const db = await getDb();
  const hash = await hashPassword(password);
  const [row] = await db.query<Row>(
    // Following the emailed link proves they own the address, so it also counts as verification.
    "update users set password_hash = $2, email_verified_at = coalesce(email_verified_at, now()) where id = $1 returning id, email, name, home_currency, home_airport, email_verified_at, password_hash",
    [userId, hash],
  );
  await db.query("delete from sessions where user_id = $1", [userId]);
  await db.query("delete from auth_attempts where key = $1", [`login:${row.email}`]);
  return toUser(row);
}

export async function sendVerification(user: Pick<User, "id" | "email" | "name">): Promise<EmailResult> {
  const token = await issueToken(user.id, "verify");
  return sendEmail({ to: user.email, ...verifyEmail(`${appUrl()}/verify/${token}`, user.name) });
}

export async function confirmEmail(token: string): Promise<void> {
  const userId = await consumeToken(token, "verify");
  const db = await getDb();
  await db.query("update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1", [userId]);
}
