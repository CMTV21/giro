import { z } from "zod";
import { sameOrigin } from "@/server/auth";
import { body, fail, ok, route } from "@/server/http";
import { confirmEmail } from "@/server/users";

export const POST = route(async (request: Request) => {
  if (!sameOrigin(request)) return fail(403, "cross_origin", "Request blocked.");
  const { token } = await body(request, z.object({ token: z.string().min(20).max(100) }));
  await confirmEmail(token);
  return ok({ ok: true });
});
