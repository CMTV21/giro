import { ok, requireUser, route } from "@/server/http";
import { deleteExpense } from "@/server/trips";

type Ctx = { params: Promise<{ id: string; expenseId: string }> };

export const DELETE = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request);
  const { id, expenseId } = await params;
  await deleteExpense(id, user.id, expenseId);
  return ok({ ok: true });
});
