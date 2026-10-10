import { NextResponse } from "next/server";
import { advisoriesFor } from "@/server/advisories";

/** Official Government of Canada advice for the countries on a trip: ?cities=Lisbon|Porto */
export async function GET(request: Request) {
  const cities = (new URL(request.url).searchParams.get("cities") ?? "")
    .split("|")
    .map((c) => c.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 6);
  if (!cities.length) return NextResponse.json({ error: "missing_cities" }, { status: 400 });
  const advisories = await advisoriesFor(cities);
  return NextResponse.json({ advisories }, { headers: { "cache-control": "public, max-age=1800" } });
}
