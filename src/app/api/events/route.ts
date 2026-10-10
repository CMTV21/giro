import { NextResponse } from "next/server";
import { clientIp, tooManyAttempts } from "@/server/auth";
import { eventsEnabled, eventsFor } from "@/server/events";

export const runtime = "nodejs";

const date = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

/** Concerts, games and shows: ?city=Lisbon&start=2026-11-10&end=2026-11-15 */
export async function GET(request: Request) {
  if (!eventsEnabled()) return NextResponse.json({ enabled: false, events: [] });
  const q = new URL(request.url).searchParams;
  const city = q.get("city")?.trim().slice(0, 80);
  const start = date(q.get("start"));
  const end = date(q.get("end"));
  if (!city || !start || !end || end < start) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (await tooManyAttempts(`events:${clientIp(request)}`, 200, 60 * 24)) return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  return NextResponse.json({ enabled: true, events: await eventsFor(city, start, end) }, { headers: { "cache-control": "private, max-age=1800" } });
}
