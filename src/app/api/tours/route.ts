import { NextResponse } from "next/server";
import { isCurrency } from "@/lib/currency";
import { clientIp, tooManyAttempts } from "@/server/auth";
import { findTour, toursEnabled } from "@/server/tours";

export const runtime = "nodejs";

/** A matching bookable tour for a stop: ?title=Torre de Belém&city=Lisbon&cur=CAD */
export async function GET(request: Request) {
  if (!toursEnabled()) return NextResponse.json({ enabled: false });
  const q = new URL(request.url).searchParams;
  const title = q.get("title")?.trim().slice(0, 160);
  const city = q.get("city")?.trim().slice(0, 80);
  const cur = q.get("cur")?.toUpperCase() ?? "CAD";
  if (!title || !city || !isCurrency(cur)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (await tooManyAttempts(`tours:${clientIp(request)}`, 400, 60 * 24)) return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  const tour = await findTour(title, city, cur);
  return NextResponse.json({ enabled: true, tour: tour ?? null }, { headers: { "cache-control": "private, max-age=3600" } });
}
