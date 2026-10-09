import assert from "node:assert/strict";
import { test } from "node:test";
import { balances, settleUp } from "../src/lib/split.ts";

test("balances are cent-exact and sum to zero", () => {
  const net = balances(
    [
      { paidBy: "a", amount: 100, splitBetween: ["a", "b", "c"] },
      { paidBy: "b", amount: 30, splitBetween: ["b", "c"] },
    ],
    ["a", "b", "c"],
  );
  assert.equal(Math.round(Object.values(net).reduce((s, v) => s + v, 0) * 100), 0);
  assert.equal(net.a, 66.66);
  assert.equal(net.c, -48.33);
});

test("settle-up clears every balance with few transfers", () => {
  const net = { a: 50, b: -20, c: -30, d: 0 };
  const transfers = settleUp(net);
  assert.equal(transfers.length, 2);
  const after = { ...net };
  for (const t of transfers) {
    after[t.from as keyof typeof after] += t.amount;
    after[t.to as keyof typeof after] -= t.amount;
  }
  assert.ok(Object.values(after).every((v) => Math.abs(v) < 0.001));
});

test("ignores expenses involving non-members", () => {
  const net = balances([{ paidBy: "x", amount: 10, splitBetween: ["a"] }], ["a"]);
  assert.deepEqual(net, { a: 0 });
});
