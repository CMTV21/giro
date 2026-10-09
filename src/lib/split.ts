/** Group cost splitting: who owes whom, with as few transfers as possible. */

export interface SplitExpense {
  paidBy: string;
  /** Amount in a common currency (Giro uses USD internally). */
  amount: number;
  splitBetween: string[];
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/** Net position per member: positive means they're owed money. Cents-exact. */
export function balances(expenses: SplitExpense[], members: string[]): Record<string, number> {
  const cents: Record<string, number> = Object.fromEntries(members.map((m) => [m, 0]));
  for (const e of expenses) {
    const among = e.splitBetween.filter((m) => m in cents);
    if (!among.length || !(e.paidBy in cents)) continue;
    const total = Math.round(e.amount * 100);
    const share = Math.floor(total / among.length);
    let remainder = total - share * among.length;
    cents[e.paidBy] += total;
    // Spread leftover cents deterministically so the ledger always sums to zero.
    for (const m of [...among].sort()) {
      cents[m] -= share + (remainder-- > 0 ? 1 : 0);
    }
  }
  return Object.fromEntries(Object.entries(cents).map(([m, c]) => [m, c / 100]));
}

/** Greedy settle-up: largest debtor pays largest creditor until everyone is square. */
export function settleUp(net: Record<string, number>): Transfer[] {
  const creditors = Object.entries(net).filter(([, v]) => v > 0.004).map(([m, v]) => ({ m, c: Math.round(v * 100) }));
  const debtors = Object.entries(net).filter(([, v]) => v < -0.004).map(([m, v]) => ({ m, c: Math.round(-v * 100) }));
  const out: Transfer[] = [];
  creditors.sort((a, b) => b.c - a.c || a.m.localeCompare(b.m));
  debtors.sort((a, b) => b.c - a.c || a.m.localeCompare(b.m));
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].c, creditors[j].c);
    if (pay > 0) out.push({ from: debtors[i].m, to: creditors[j].m, amount: pay / 100 });
    debtors[i].c -= pay;
    creditors[j].c -= pay;
    if (debtors[i].c === 0) i++;
    if (creditors[j].c === 0) j++;
  }
  return out;
}
