import { z } from "zod";
import { body, ok, requireUser, route } from "@/server/http";
import { createTrip, listTrips } from "@/server/trips";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const user = await requireUser(request, { mutation: false });
  return ok({ trips: await listTrips(user.id) });
});

export const POST = route(async (request: Request) => {
  const user = await requireUser(request);
  return ok(await createTrip(user.id, await body(request, z.unknown())));
});
