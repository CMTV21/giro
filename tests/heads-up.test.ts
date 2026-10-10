import assert from "node:assert/strict";
import { test } from "node:test";
import { HEADS_UP, OFFICIAL_ADVICE_URL } from "../src/data/heads-up.ts";
import { DESTINATIONS } from "../src/lib/destinations.ts";

test("every catalog city has 2–4 heads-up notes, and every note belongs to a real city", () => {
  const slugs = new Set(DESTINATIONS.map((d) => d.slug));
  assert.deepEqual(Object.keys(HEADS_UP).filter((k) => !slugs.has(k)), []);
  for (const d of DESTINATIONS) {
    const notes = HEADS_UP[d.slug];
    assert.ok(notes && notes.length >= 2 && notes.length <= 4, d.slug);
    for (const n of notes) {
      assert.ok(n.text.length > 40 && n.text.length < 260, `${d.slug}: ${n.text.slice(0, 30)}`);
      assert.doesNotMatch(n.text, /\b(always|never)\s+safe\b|dangerous neighbourhood/i, "no blanket claims");
    }
  }
  assert.match(OFFICIAL_ADVICE_URL, /^https:\/\/travel\.gc\.ca\//);
});
