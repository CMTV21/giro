import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { currentUser, sameOrigin, type User } from "./auth.ts";
import { HttpError } from "./errors.ts";

export { HttpError };

export const ok = <T,>(data: T, init?: ResponseInit) => NextResponse.json(data, init);
export const fail = (status: number, code: string, message: string) => NextResponse.json({ error: code, message }, { status });

const MAX_BODY = 512 * 1024;

/** Read and validate a JSON body with a size cap. */
export async function body<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, "too_large", "That request is too large.");
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "invalid_json", "Malformed request.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new HttpError(400, "invalid_request", parsed.error.issues[0]?.message ?? "Invalid request.");
  return parsed.data;
}

/** Signed-in user for a mutation; enforces same-origin to block CSRF. */
export async function requireUser(request: Request, { mutation = true } = {}): Promise<User> {
  if (mutation && !sameOrigin(request)) throw new HttpError(403, "cross_origin", "Request blocked.");
  const user = await currentUser(request);
  if (!user) throw new HttpError(401, "unauthenticated", "Please sign in.");
  return user;
}

/** Wrap a route handler so HttpErrors become JSON responses and unexpected errors are logged. */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.code, err.message);
      console.error(err);
      return fail(500, "server_error", "Something went wrong.");
    }
  };
}
