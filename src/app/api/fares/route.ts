import { NextResponse } from "next/server";
import { isCurrency } from "@/lib/currency";
import { clientIp, tooManyAttempts } from "@/server/auth";
import { faresEnabled, findFares } from "@/server/fares";

export const runtime = "nodejs";

const iata = (s: string | null) => (s && /^[A-Za-z]{3}$/.test(s) ? s.toUpperCase() : undefined);
const date = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

/** Recently seen return fares: ?from=YYZ&to=LIS&depart=2026-11-10&return=2026-11-15&cur=CAD */
export async function GET(request: Request) {
  if (!faresEnabled()) return NextResponse.json({ enabled: false });
  const q = new URL(request.url).searchParams;
  const from = iata(q.get("from"));
  const to = iata(q.get("to"));
  const depart = date(q.get("depart"));
  const ret = date(q.get("return"));
  const cur = q.get("cur")?.toUpperCase() ?? "CAD";
  if (!from || !to || !depart || !ret || ret < depart || !isCurrency(cur)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (await tooManyAttempts(`fares:${clientIp(request)}`, 200, 60 * 24)) return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  const fares = await findFares(from, to, depart, ret, cur);
  return NextResponse.json({ enabled: true, fares: fares ?? null }, { headers: { "cache-control": "private, max-age=1800" } });
}
