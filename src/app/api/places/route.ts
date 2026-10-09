import { NextResponse } from "next/server";
import { lookupPlace } from "@/server/places";

export const runtime = "nodejs";

// Per-instance limiter: lookups are cached, but uncached ones call Wikipedia/Nominatim (and Claude).
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= 300) return true;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const title = q.get("title")?.trim().slice(0, 120);
  const city = q.get("city")?.trim().slice(0, 80);
  if (!title || !city) return NextResponse.json({ error: "missing_params" }, { status: 400 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    const info = await lookupPlace(title, city, q.get("daytrip") === "1");
    return NextResponse.json(info, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
  } catch (err) {
    console.error("place lookup failed", err);
    return NextResponse.json({ source: "none" }, { status: 200 });
  }
}
