import { z } from "zod";
import { clientIp, tooManyAttempts } from "@/server/auth";
import { body, fail, ok, route } from "@/server/http";
import { routeLegs, routingEnabled } from "@/server/routing";

export const runtime = "nodejs";

const Post = z.object({ points: z.array(z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })).min(2).max(12) });

export const GET = () => ok({ enabled: routingEnabled() });

/** Travel time between consecutive stops of a day. */
export const POST = route(async (request: Request) => {
  if (!routingEnabled()) return ok({ enabled: false, legs: [] });
  if (await tooManyAttempts(`route:${clientIp(request)}`, 400, 60 * 24)) return fail(429, "too_many_attempts", "Too many lookups today.");
  const { points } = await body(request, Post);
  return ok({ enabled: true, legs: await routeLegs(points) });
});
