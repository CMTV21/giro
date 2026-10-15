import { z } from "zod";
import { clientIp, currentUser, sameOrigin, tooManyAttempts } from "@/server/auth";
import { joinWaitlist } from "@/server/funnel";
import { body, fail, ok, route } from "@/server/http";

export const runtime = "nodejs";

const Post = z.object({ email: z.string().trim().email().max(200), tripId: z.string().max(40).optional() });

/** Group Trip Pass waitlist: nothing is charged; we email once when the Pass is ready. */
export const POST = route(async (request: Request) => {
  if (!sameOrigin(request)) return fail(403, "cross_origin", "Request blocked.");
  if (await tooManyAttempts(`waitlist:${clientIp(request)}`, 10, 60 * 24)) return fail(429, "too_many_attempts", "Too many sign-ups today.");
  const { email, tripId } = await body(request, Post);
  const user = await currentUser(request);
  const added = await joinWaitlist({ email, userId: user?.id, tripId });
  return ok({ added });
});
