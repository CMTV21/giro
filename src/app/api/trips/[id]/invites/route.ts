import { z } from "zod";
import { appUrl, inviteEmail, sendEmail } from "@/server/email";
import { body, ok, requireUser, route } from "@/server/http";
import { tooManyAttempts } from "@/server/auth";
import { createInvite, tripTitle } from "@/server/trips";

type Ctx = { params: Promise<{ id: string }> };
const Schema = z.object({ role: z.enum(["editor", "viewer"]), email: z.string().email().max(254).optional() });

export const POST = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request);
  const { role, email } = await body(request, Schema);
  const id = (await params).id;
  const token = await createInvite(id, user.id, role);
  const path = `/join/${token}`;
  if (!email) return ok({ path });
  // Cap invite emails so the endpoint can't be used to spam strangers.
  if (await tooManyAttempts(`invite-email:${user.id}`, 30, 60 * 24)) return ok({ path, emailed: false, reason: "limit" });
  const result = await sendEmail({ to: email.trim().toLowerCase(), ...inviteEmail(`${appUrl()}${path}`, user.name, await tripTitle(id), role) });
  return ok({ path, emailed: result.sent, reason: result.reason });
});
