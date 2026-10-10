import { z } from "zod";
import { body, ok, requireUser, route } from "@/server/http";
import { inboundConfigured, inboxAddress, listInbox, resolveInboxItem } from "@/server/inbound";
import { tripLink } from "@/server/links";
import { getDb } from "@/server/db";
import { roleFor } from "@/server/trips";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** The trip's forwarding address (editors) and recent forwarded emails (members). */
export const GET = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request, { mutation: false });
  const id = (await params).id;
  const items = await listInbox(id, user.id);
  if (!inboundConfigured()) return ok({ enabled: false, items });
  const role = await roleFor(await getDb(), id, user.id);
  const address = role === "owner" || role === "editor" ? inboxAddress(await tripLink(id, user.id, "inbox")) : undefined;
  return ok({ enabled: true, address, items });
});

const Post = z.union([
  z.object({ itemId: z.string().min(1).max(40), action: z.enum(["apply", "dismiss"]) }),
  z.object({ rotate: z.literal(true) }),
]);

/** Add or dismiss a held email, or replace the forwarding address. */
export const POST = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request);
  const id = (await params).id;
  const input = await body(request, Post);
  if ("rotate" in input) return ok({ address: inboxAddress(await tripLink(id, user.id, "inbox", { rotate: true })) });
  return ok({ status: await resolveInboxItem(id, user.id, input.itemId, input.action) });
});
