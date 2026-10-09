import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, SESSION_COOKIE } from "@/server/auth";
import { body, ok, requireUser, route } from "@/server/http";
import { deleteAccount, getTaste, updateProfile } from "@/server/users";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const user = await currentUser(request);
  if (!user) return ok({ user: null });
  return ok({ user, taste: (await getTaste(user.id)) ?? null });
});

const Patch = z.object({ name: z.string().max(80).optional(), homeCurrency: z.string().max(3).optional(), homeAirport: z.string().max(60).optional() });

export const PATCH = route(async (request: Request) => {
  const user = await requireUser(request);
  return ok({ user: await updateProfile(user.id, await body(request, Patch)) });
});

export const DELETE = route(async (request: Request) => {
  const user = await requireUser(request);
  await deleteAccount(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", expires: new Date(0) });
  return res;
});
