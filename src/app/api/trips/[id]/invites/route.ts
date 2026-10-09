import { z } from "zod";
import { body, ok, requireUser, route } from "@/server/http";
import { createInvite } from "@/server/trips";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request);
  const { role } = await body(request, z.object({ role: z.enum(["editor", "viewer"]) }));
  const token = await createInvite((await params).id, user.id, role);
  return ok({ path: `/join/${token}` });
});
