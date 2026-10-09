import { readUpload } from "@/server/files";
import { ok, requireUser, route } from "@/server/http";
import { uploadReceipt } from "@/server/receipts";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request);
  const file = await readUpload(request);
  return ok(await uploadReceipt((await params).id, user.id, file));
});
