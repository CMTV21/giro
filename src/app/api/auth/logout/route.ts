import { NextResponse } from "next/server";
import { destroySession, readCookie, sameOrigin, SESSION_COOKIE } from "@/server/auth";
import { fail, route } from "@/server/http";

export const POST = route(async (request: Request) => {
  if (!sameOrigin(request)) return fail(403, "cross_origin", "Request blocked.");
  await destroySession(readCookie(request, SESSION_COOKIE));
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", expires: new Date(0) });
  return res;
});
