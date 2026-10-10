import { NextResponse } from "next/server";
import { resolveDestination } from "@/lib/curate";
import { slugify } from "@/lib/food";
import { communityPicks } from "@/server/community";

export const runtime = "nodejs";

/** Community picks for one city: catalog stops and food-guide restaurants many travellers chose. */
export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get("city")?.trim().slice(0, 80);
  if (!city) return NextResponse.json({ error: "missing_city" }, { status: 400 });
  const keys = new Set(resolveDestination(city).activities.map((a) => a.key));
  const food = `food:${slugify(city)}:`;
  try {
    const all = await communityPicks();
    const picks = Object.fromEntries([...all].filter(([ref]) => keys.has(ref) || ref.startsWith(food)));
    return NextResponse.json({ picks }, { headers: { "cache-control": "public, max-age=600, s-maxage=600" } });
  } catch (err) {
    console.error("community picks failed", err);
    return NextResponse.json({ picks: {} });
  }
}
