import { z } from "zod";
import { CURRENCIES } from "@/lib/currency";
import { getRates } from "@/lib/rates.server";
import { body, ok, requireUser, route } from "@/server/http";
import { addExpense } from "@/server/trips";

type Ctx = { params: Promise<{ id: string }> };
const Schema = z.object({
  paidBy: z.string().max(40),
  amount: z.number().positive().max(1_000_000),
  currency: z.enum(CURRENCIES),
  description: z.string().max(120),
  splitBetween: z.array(z.string().max(40)).min(1).max(50),
  receiptId: z.string().max(40).optional(),
});

export const POST = route(async (request: Request, { params }: Ctx) => {
  const user = await requireUser(request);
  const input = await body(request, Schema);
  const { rates } = await getRates();
  return ok({ expense: await addExpense((await params).id, user.id, input, rates) });
});
