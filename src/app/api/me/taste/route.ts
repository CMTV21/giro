import { z } from "zod";
import { parseTaste } from "@/lib/taste";
import { body, HttpError, ok, requireUser, route } from "@/server/http";
import { setTaste } from "@/server/users";

export const PUT = route(async (request: Request) => {
  const user = await requireUser(request);
  const profile = parseTaste(await body(request, z.unknown()));
  if (!profile) throw new HttpError(400, "invalid_taste", "Invalid profile.");
  await setTaste(user.id, profile);
  return ok({ ok: true });
});
