import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { recordClick } from "@/server/clicks";

export const dynamic = "force-dynamic";

/** Outbound partner redirect: logs the click for commission tracking, then sends the traveller on. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const user = await currentUser(request).catch(() => undefined);
  const target = await recordClick({
    url: q.get("u") ?? "",
    provider: q.get("p") ?? "",
    kind: q.get("k") ?? "other",
    tripId: q.get("t") ?? undefined,
    valueUSD: Number(q.get("v")) || 0,
    userId: user?.id,
  });
  if (!target) return new NextResponse("That link isn't a recognised partner site.", { status: 400 });
  return NextResponse.redirect(target, { status: 302, headers: { "x-robots-tag": "noindex", "referrer-policy": "strict-origin-when-cross-origin" } });
}
