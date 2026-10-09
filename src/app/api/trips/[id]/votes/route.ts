import { z } from "zod";
import { body, ok, requireUser, route } from "@/server/http";
import { vote } from "@/server/trips";

type Ctx = { params: Promise<{ id: string }> };
const Schema = z.object({ activityId: z.string().min(1).max(40), value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) });

export const PUT = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request);
  const { activityId, value } = await body(request, Schema);
  await vote((await params).id, user.id, activityId, value);
  return ok({ ok: true });
});
