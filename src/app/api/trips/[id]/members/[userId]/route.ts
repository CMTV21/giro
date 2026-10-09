import { z } from "zod";
import { body, ok, requireUser, route } from "@/server/http";
import { removeMember, setMemberRole } from "@/server/trips";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export const DELETE = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request);
  const { id, userId } = await params;
  await removeMember(id, user.id, userId);
  return ok({ ok: true });
});

export const PATCH = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request);
  const { id, userId } = await params;
  const { role } = await body(request, z.object({ role: z.enum(["editor", "viewer"]) }));
  await setMemberRole(id, user.id, userId, role);
  return ok({ ok: true });
});
