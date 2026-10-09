import { tooManyAttempts } from "@/server/auth";
import { fail, ok, requireUser, route } from "@/server/http";
import { sendVerification } from "@/server/users";

/** Resend the confirmation email. */
export const POST = route(async (request: Request) => {
  const user = await requireUser(request);
  if (user.emailVerified) return ok({ sent: false, alreadyVerified: true });
  if (await tooManyAttempts(`verify:${user.id}`, 5, 60)) return fail(429, "too_many_attempts", "Please wait a bit before asking for another email.");
  const result = await sendVerification(user);
  return ok(result);
});
