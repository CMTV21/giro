import { NextResponse } from "next/server";
import { clientIp, tooManyAttempts } from "@/server/auth";
import { placeDetails, placesEnabled } from "@/server/google-places";

export const runtime = "nodejs";

/** Live Google details for a stop's details panel: ?title=Torre de Belém&city=Lisbon */
export async function GET(request: Request) {
  if (!placesEnabled()) return NextResponse.json({ enabled: false });
  const q = new URL(request.url).searchParams;
  const title = q.get("title")?.trim().slice(0, 160);
  const city = q.get("city")?.trim().slice(0, 80);
  if (!title || !city) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (await tooManyAttempts(`details:${clientIp(request)}`, 200, 60 * 24)) return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  const details = await placeDetails(title, city);
  return NextResponse.json({ enabled: true, details: details ?? null }, { headers: { "cache-control": "private, max-age=600" } });
}
