import { NextResponse } from "next/server";
import { flightNumberKey } from "@/lib/flight-status";
import { clientIp, tooManyAttempts } from "@/server/auth";
import { flightStatus, flightStatusEnabled } from "@/server/flight-status";

export const runtime = "nodejs";

/** Live status for a booked flight: ?number=AC1906&date=2026-11-10 (departure date, local). */
export async function GET(request: Request) {
  if (!flightStatusEnabled()) return NextResponse.json({ enabled: false });
  const q = new URL(request.url).searchParams;
  const number = flightNumberKey(q.get("number") ?? undefined);
  const date = q.get("date");
  if (!number || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (await tooManyAttempts(`flight:${clientIp(request)}`, 300, 60 * 24)) return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  return NextResponse.json({ enabled: true, status: (await flightStatus(number, date)) ?? null }, { headers: { "cache-control": "private, max-age=300" } });
}
