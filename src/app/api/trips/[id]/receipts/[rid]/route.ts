import { requireUser, route } from "@/server/http";
import { getReceipt } from "@/server/receipts";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string; rid: string }> };

/** Serve a receipt to trip members only, with headers that stop it being treated as a web page. */
export const GET = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request, { mutation: false });
  const { id, rid } = await params;
  const r = await getReceipt(id, user.id, rid);
  return new Response(r.bytes as BodyInit, {
    headers: {
      "content-type": r.mime,
      "content-disposition": `inline; filename="${r.name.replace(/"/g, "")}"`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "cache-control": "private, max-age=3600",
    },
  });
});
