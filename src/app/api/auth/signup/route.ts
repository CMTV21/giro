import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, createSession, sameOrigin, sessionCookie, tooManyAttempts } from "@/server/auth";
import { body, fail, route } from "@/server/http";
import { signup } from "@/server/users";

const Schema = z.object({ email: z.string().max(254), password: z.string().max(200), name: z.string().max(80).default(""), homeCurrency: z.string().max(3).optional() });

export const POST = route(async (request: Request) => {
  if (!sameOrigin(request)) return fail(403, "cross_origin", "Request blocked.");
  if (await tooManyAttempts(`signup:${clientIp(request)}`, 10, 60)) return fail(429, "too_many_attempts", "Too many sign-ups from this network. Try again later.");
  const user = await signup(await body(request, Schema));
  const { token, expires } = await createSession(user.id);
  const res = NextResponse.json({ user });
  res.cookies.set(sessionCookie(token, expires));
  return res;
});
