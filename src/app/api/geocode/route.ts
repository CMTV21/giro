import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { geocodeAddress } from "@/server/places";

export const runtime = "nodejs";

/** Address → coordinates for stays on the map. Signed-in only, since addresses are personal. */
export async function GET(request: Request) {
  const user = await currentUser(request).catch(() => undefined);
  const q = new URL(request.url).searchParams;
  const address = q.get("address")?.trim().slice(0, 300);
  const city = q.get("city")?.trim().slice(0, 80);
  if (!address || !city) return NextResponse.json({ error: "missing_params" }, { status: 400 });
  if (!user && process.env.NODE_ENV === "production") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const hit = await geocodeAddress(address, city).catch(() => undefined);
  return NextResponse.json(hit ?? {}, { headers: { "cache-control": "private, max-age=86400" } });
}
