import { z } from "zod";
import { clientIp, sameOrigin } from "@/server/auth";
import { emailConfigured } from "@/server/email";
import { body, fail, ok, route } from "@/server/http";
import { requestPasswordReset } from "@/server/users";

export const POST = route(async (request: Request) => {
  if (!sameOrigin(request)) return fail(403, "cross_origin", "Request blocked.");
  if (!emailConfigured() && process.env.NODE_ENV === "production") {
    return fail(503, "email_unavailable", "Password reset emails aren't set up yet. Please contact support.");
  }
  const { email } = await body(request, z.object({ email: z.string().max(254) }));
  await requestPasswordReset(email, clientIp(request));
  // Same response whether or not the account exists.
  return ok({ ok: true });
});
