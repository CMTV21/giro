import { NextResponse } from "next/server";
import { clientIp, tooManyAttempts } from "@/server/auth";
import { placePhotos, placesEnabled } from "@/server/google-places";

export const runtime = "nodejs";

/**
 * Google photos of a stop: ?title=…&city=…&count=1&width=400. Returns short-lived image URLs with
 * the photographer's credit; an empty list (off, unknown place, or over the monthly cap) means the
 * browser falls back to Wikimedia.
 */
export async function GET(request: Request) {
  if (!placesEnabled()) return NextResponse.json({ enabled: false, photos: [] });
  const q = new URL(request.url).searchParams;
  const title = q.get("title")?.trim().slice(0, 160);
  const city = q.get("city")?.trim().slice(0, 80);
  if (!title || !city) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (await tooManyAttempts(`photos:${clientIp(request)}`, 400, 60 * 24)) return NextResponse.json({ enabled: true, photos: [] });
  const count = Math.max(1, Math.min(4, Number(q.get("count")) || 1));
  const width = Math.max(200, Math.min(1600, Number(q.get("width")) || 480));
  const photos = await placePhotos(title, city, count, width);
  return NextResponse.json({ enabled: true, photos }, { headers: { "cache-control": "private, max-age=600" } });
}
