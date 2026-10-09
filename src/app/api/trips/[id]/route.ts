import { z } from "zod";
import { body, ok, requireUser, route } from "@/server/http";
import { deleteOrLeaveTrip, getTripBundle, updateTrip } from "@/server/trips";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request, { mutation: false });
  return ok({ ...(await getTripBundle((await params).id, user.id)), me: user.id });
});

const Put = z.object({ trip: z.unknown(), version: z.number().int().min(1) });

export const PUT = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request);
  const { trip, version } = await body(request, Put);
  return ok(await updateTrip((await params).id, user.id, trip, version));
});

export const DELETE = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request);
  return ok({ result: await deleteOrLeaveTrip((await params).id, user.id) });
});
