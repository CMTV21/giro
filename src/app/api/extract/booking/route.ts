import { aiAvailable } from "@/lib/ai";
import { tooManyAttempts } from "@/server/auth";
import { readBooking } from "@/server/extract";
import { readUpload } from "@/server/files";
import { fail, ok, requireUser, route } from "@/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Read a flight or hotel confirmation (photo or PDF) into fields the traveller reviews before saving. Nothing is stored. */
export const POST = route(async (request: Request) => {
  const user = await requireUser(request);
  if (!aiAvailable()) return fail(503, "ai_unavailable", "Reading confirmations needs Giro AI, which isn't set up.");
  if (await tooManyAttempts(`extract:${user.id}`, 30, 60 * 24)) return fail(429, "too_many_attempts", "You've hit today's limit for reading documents.");
  const { bytes, mime } = await readUpload(request);
  return ok(await readBooking(mime, bytes));
});
