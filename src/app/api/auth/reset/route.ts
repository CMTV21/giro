import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, sameOrigin, sessionCookie } from "@/server/auth";
import { body, fail, route } from "@/server/http";
import { resetPassword } from "@/server/users";

export const POST = route(async (request: Request) => {
  if (!sameOrigin(request)) return fail(403, "cross_origin", "Request blocked.");
  const { token, password } = await body(request, z.object({ token: z.string().min(20).max(100), password: z.string().max(200) }));
  const user = await resetPassword(token, password);
  const { token: session, expires } = await createSession(user.id);
  const res = NextResponse.json({ user });
  res.cookies.set(sessionCookie(session, expires));
  return res;
});
