import { z } from "zod";
import { clientIp, tooManyAttempts } from "@/server/auth";
import { hoursEnabled, hoursKey, lookupHours, type PlaceHours } from "@/server/hours";
import { body, fail, ok, route } from "@/server/http";

export const runtime = "nodejs";

const Post = z.object({ items: z.array(z.object({ title: z.string().min(1).max(160), city: z.string().min(1).max(80) })).max(40) });

/** Opening hours for a trip's stops, keyed by hoursKey(title, city). */
export const POST = route(async (request: Request) => {
  if (!hoursEnabled()) return ok({ enabled: false, hours: {} });
  if (await tooManyAttempts(`hours:${clientIp(request)}`, 300, 60 * 24)) return fail(429, "too_many_attempts", "Too many lookups today.");
  const { items } = await body(request, Post);
  const hours: Record<string, PlaceHours> = {};
  const unique = [...new Map(items.map((i) => [hoursKey(i.title, i.city), i])).entries()];
  // A few at a time keeps the provider happy.
  for (let i = 0; i < unique.length; i += 5) {
    await Promise.all(unique.slice(i, i + 5).map(async ([key, item]) => (hours[key] = await lookupHours(item.title, item.city))));
  }
  return ok({ enabled: true, hours }, { headers: { "cache-control": "private, max-age=3600" } });
});
