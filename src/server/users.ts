import "server-only";
import { isCurrency, type Currency } from "../lib/currency.ts";
import { parseTaste, type TasteProfile } from "../lib/taste.ts";
import { dummyPasswordHash, hashPassword, newId, normalizeEmail, passwordProblem, toUser, tooManyAttempts, validEmail, verifyPassword, type User } from "./auth.ts";
import { getDb } from "./db.ts";
import { HttpError } from "./errors.ts";

interface Row {
  id: string;
  email: string;
  name: string;
  home_currency: string;
  home_airport: string;
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
     returning id, email, name, home_currency, home_airport, password_hash`,
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
  const [row] = await db.query<Row>("select id, email, name, home_currency, home_airport, password_hash from users where email = $1", [email]);
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
     returning id, email, name, home_currency, home_airport, password_hash`,
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
