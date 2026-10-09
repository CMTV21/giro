import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, createSession, sameOrigin, sessionCookie } from "@/server/auth";
import { body, fail, route } from "@/server/http";
import { login } from "@/server/users";

const Schema = z.object({ email: z.string().max(254), password: z.string().max(200) });

export const POST = route(async (request: Request) => {
  if (!sameOrigin(request)) return fail(403, "cross_origin", "Request blocked.");
  const user = await login(await body(request, Schema), clientIp(request));
  const { token, expires } = await createSession(user.id);
  const res = NextResponse.json({ user });
  res.cookies.set(sessionCookie(token, expires));
  return res;
});
