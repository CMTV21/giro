import { tripToICS } from "@/lib/export";
import { tripForLink } from "@/server/links";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ file: string }> };

/** Live calendar feed: /cal/<token>.ics. Calendar apps re-fetch it, so edits show up on their own. */
export async function GET(_request: Request, { params }: Ctx) {
  const token = (await params).file.replace(/\.ics$/, "");
  const found = await tripForLink(token, "calendar").catch(() => undefined);
  if (!found) return new Response("This calendar link has been turned off or doesn't exist.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(tripToICS(found.trip, { feed: true }), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="giro-trip.ics"`,
      "cache-control": "private, max-age=900",
      "x-robots-tag": "noindex",
    },
  });
}
