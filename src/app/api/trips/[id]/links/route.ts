import { z } from "zod";
import { body, ok, requireUser, route } from "@/server/http";
import { tripLink } from "@/server/links";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const Post = z.object({ purpose: z.enum(["calendar", "inbox"]), rotate: z.boolean().optional() });

/** Get (or replace) a trip's calendar feed token or forwarding-address token. */
export const POST = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request);
  const { purpose, rotate } = await body(request, Post);
  return ok({ token: await tripLink((await params).id, user.id, purpose, { rotate }) });
});
