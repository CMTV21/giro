import { NextResponse } from "next/server";
import { handleInbound, inboundConfigured, verifyInbound } from "@/server/inbound";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_RAW = 4_400_000; // Vercel caps request bodies at 4.5 MB

/** Raw emails from the Cloudflare Email Worker (signed). Responds with what happened so the worker can bounce unknown addresses. */
export async function POST(request: Request) {
  if (!inboundConfigured()) return NextResponse.json({ status: "disabled" }, { status: 503 });
  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.length > MAX_RAW) return NextResponse.json({ status: "too_large" }, { status: 413 });
  const envelope = verifyInbound(request.headers, raw);
  if (!envelope) return NextResponse.json({ status: "bad_signature" }, { status: 401 });
  try {
    const result = await handleInbound(raw, envelope);
    const code = result.status === "unknown_address" ? 404 : result.status === "rate_limited" ? 429 : 200;
    return NextResponse.json(result, { status: code });
  } catch (err) {
    console.error("inbound failed", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
