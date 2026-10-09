import { z } from "zod";
import { body, ok, requireUser, route } from "@/server/http";
import { acceptInvite } from "@/server/trips";

export const POST = route(async (request: Request) => {
  const user = await requireUser(request);
  const { token } = await body(request, z.object({ token: z.string().min(10).max(100) }));
  return ok(await acceptInvite(token, user.id));
});
