import { z } from "zod";
import { CLIENT_EVENTS } from "@/lib/pass";
import { clientIp, sameOrigin, tooManyAttempts } from "@/server/auth";
import { recordEvent } from "@/server/funnel";
import { body, fail, ok, route } from "@/server/http";

export const runtime = "nodejs";

const Post = z.object({
  kind: z.enum(CLIENT_EVENTS),
  tripId: z.string().max(40).optional(),
  detail: z.record(z.string().max(20), z.union([z.number(), z.boolean(), z.string().max(40)])).optional(),
});

/** Anonymous launch-funnel events from the browser (a trip planned, the Pass page viewed). */
export const POST = route(async (request: Request) => {
  if (!sameOrigin(request)) return fail(403, "cross_origin", "Request blocked.");
  if (await tooManyAttempts(`funnel:${clientIp(request)}`, 100, 60 * 24)) return ok({ recorded: false });
  const { kind, tripId, detail } = await body(request, Post);
  await recordEvent(kind, tripId, detail);
  return ok({ recorded: true });
});
