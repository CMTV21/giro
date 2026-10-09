import "server-only";
import { newId } from "./auth.ts";
import { getDb } from "./db.ts";
import { forbidden, HttpError, notFound } from "./errors.ts";
import type { SafeMime } from "./files.ts";
import { roleFor } from "./trips.ts";

/**
 * Receipt photos and PDFs, stored in Postgres (bytea) so there's no extra storage service to
 * run. Only members of the trip can upload or view them. Swap for object storage (e.g. Vercel
 * Blob, S3) when volumes grow.
 */

async function requireMember(tripId: string, userId: string) {
  const db = await getDb();
  const role = await roleFor(db, tripId, userId);
  if (!role) {
    const [exists] = await db.query("select 1 from trips where id = $1", [tripId]);
    throw exists ? forbidden() : notFound("That trip");
  }
  return db;
}

export async function uploadReceipt(tripId: string, userId: string, file: { bytes: Uint8Array; mime: SafeMime; name: string }): Promise<{ id: string }> {
  const db = await requireMember(tripId, userId);
  // Drop receipts that were uploaded but never attached to an expense.
  await db.query("delete from receipts where trip_id = $1 and expense_id is null and created_at < now() - interval '1 day'", [tripId]);
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from receipts where trip_id = $1", [tripId]);
  if (Number(n) >= 300) throw new HttpError(413, "too_many_receipts", "This trip has reached its receipt limit.");
  const id = newId();
  // Hex text input works identically with both Postgres drivers.
  await db.query("insert into receipts (id, trip_id, uploaded_by, mime, size, name, data) values ($1, $2, $3, $4, $5, $6, decode($7, 'hex'))", [id, tripId, userId, file.mime, file.bytes.length, file.name, Buffer.from(file.bytes).toString("hex")]);
  return { id };
}

export async function getReceipt(tripId: string, userId: string, receiptId: string): Promise<{ mime: SafeMime; name: string; bytes: Uint8Array }> {
  const db = await requireMember(tripId, userId);
  const [row] = await db.query<{ mime: SafeMime; name: string; b64: string }>("select mime, name, encode(data, 'base64') as b64 from receipts where id = $1 and trip_id = $2", [receiptId, tripId]);
  if (!row) throw notFound("That receipt");
  return { mime: row.mime, name: row.name, bytes: new Uint8Array(Buffer.from(row.b64.replace(/\s/g, ""), "base64")) };
}

/** Attach an uploaded receipt to the expense it belongs to (only the uploader's own, unattached receipts). */
export async function attachReceipt(tripId: string, userId: string, receiptId: string, expenseId: string): Promise<void> {
  const db = await getDb();
  await db.query("update receipts set expense_id = $4 where id = $1 and trip_id = $2 and uploaded_by = $3 and expense_id is null", [receiptId, tripId, userId, expenseId]);
}

export async function receiptIdsByExpense(tripId: string): Promise<Record<string, string[]>> {
  const db = await getDb();
  const rows = await db.query<{ id: string; expense_id: string }>("select id, expense_id from receipts where trip_id = $1 and expense_id is not null order by created_at", [tripId]);
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.expense_id] ??= []).push(r.id);
  return out;
}
