import { z } from "zod";
import { clientIp, tooManyAttempts } from "@/server/auth";
import { lookupHours, placeKey, placesEnabled, type PlaceHours } from "@/server/google-places";
import { body, fail, ok, route } from "@/server/http";

export const runtime = "nodejs";

const Post = z.object({ items: z.array(z.object({ title: z.string().min(1).max(160), city: z.string().min(1).max(80) })).max(40) });

/**
 * Live opening hours for a trip's stops, keyed by placeKey(title, city). The browser only asks for
 * days in the next two weeks, so the monthly allowance goes to trips that are about to happen.
 */
export const POST = route(async (request: Request) => {
  if (!placesEnabled()) return ok({ enabled: false, hours: {} });
  if (await tooManyAttempts(`hours:${clientIp(request)}`, 300, 60 * 24)) return fail(429, "too_many_attempts", "Too many lookups today.");
  const { items } = await body(request, Post);
  const hours: Record<string, PlaceHours> = {};
  const unique = [...new Map(items.map((i) => [placeKey(i.title, i.city), i])).entries()];
  // A few at a time keeps the provider happy.
  for (let i = 0; i < unique.length; i += 5) {
    await Promise.all(unique.slice(i, i + 5).map(async ([key, item]) => (hours[key] = await lookupHours(item.title, item.city))));
  }
  // Google's terms don't allow storing this content, so browsers may keep it only briefly.
  return ok({ enabled: true, hours }, { headers: { "cache-control": "private, max-age=600" } });
});
