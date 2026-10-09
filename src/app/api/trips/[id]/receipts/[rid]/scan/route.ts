import { aiAvailable } from "@/lib/ai";
import { tooManyAttempts } from "@/server/auth";
import { readReceipt } from "@/server/extract";
import { fail, ok, requireUser, route } from "@/server/http";
import { getReceipt } from "@/server/receipts";

export const runtime = "nodejs";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string; rid: string }> };

/** Read a stored receipt with Claude to pre-fill the expense form. */
export const POST = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request);
  if (!aiAvailable()) return fail(503, "ai_unavailable", "Receipt scanning needs Giro AI, which isn't set up.");
  if (await tooManyAttempts(`scan:${user.id}`, 60, 60 * 24)) return fail(429, "too_many_attempts", "You've hit today's receipt-scanning limit.");
  const { id, rid } = await params;
  const r = await getReceipt(id, user.id, rid);
  return ok(await readReceipt(r.mime, r.bytes));
});
