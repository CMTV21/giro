import assert from "node:assert/strict";
import { test } from "node:test";
import { checkHours, hoursLabel, intervalsOn, parseGoogleHours, weekdayOf, type OpeningHours } from "../src/lib/hours.ts";

// A museum: closed Mondays, 9–18 (Fri until 21:45). Google's shape (0 = Sunday).
const museum = parseGoogleHours({
  businessStatus: "OPERATIONAL",
  regularOpeningHours: {
    periods: [0, 2, 3, 4, 6].map((day) => ({ open: { day, hour: 9, minute: 0 }, close: { day, hour: 18, minute: 0 } })).concat([{ open: { day: 5, hour: 9, minute: 0 }, close: { day: 5, hour: 21, minute: 45 } }]),
  },
})!;
// A bar open 20:00 to 03:00, Thursday to Saturday.
const bar: OpeningHours = { periods: [4, 5, 6].map((day) => ({ open: { day, hour: 20, minute: 0 }, close: { day: (day + 1) % 7, hour: 3, minute: 0 } })) };

test("weekday maths", () => {
  assert.equal(weekdayOf("2026-11-09"), 1, "a Monday");
  assert.equal(weekdayOf("2026-11-15"), 0, "a Sunday");
});

test("closed days, late openings and early closings", () => {
  assert.deepEqual(checkHours(museum, "2026-11-09", 600, 720), { ok: false, kind: "closed_day", message: "Closed on Mondays." });
  const early = checkHours(museum, "2026-11-10", 480, 600);
  assert.equal(early.ok, false);
  assert.equal(!early.ok && early.kind, "opens_later");
  assert.match(!early.ok ? early.message : "", /Opens at 9:00 a\.m\./);
  const late = checkHours(museum, "2026-11-10", 960, 1140);
  assert.equal(!late.ok && late.kind, "closes_earlier");
  assert.match(!late.ok ? late.message : "", /Closes at 6:00 p\.m\./);
  assert.deepEqual(checkHours(museum, "2026-11-13", 1140, 1260), { ok: true, opens: 540, closes: 1305 }, "Friday late opening");
});

test("overnight hours carry into the next day, including Saturday into Sunday", () => {
  assert.equal(checkHours(bar, "2026-11-12", 1290, 1500).ok, true, "Thursday 21:30 to 01:00");
  const sat = intervalsOn(bar, 6);
  assert.deepEqual(sat, [{ opens: 0, closes: 180 }, { opens: 1200, closes: 1620 }]);
  assert.deepEqual(intervalsOn(bar, 0), [{ opens: 0, closes: 180 }], "Saturday night spills into Sunday");
  assert.equal(checkHours(bar, "2026-11-10", 1290, 1400).ok, false, "closed Tuesday");
});

test("labels, 24-hour places and closures", () => {
  assert.equal(hoursLabel(museum, "2026-11-10"), "9:00 a.m. – 6:00 p.m.");
  assert.equal(hoursLabel(museum, "2026-11-09"), "Closed");
  const always = parseGoogleHours({ regularOpeningHours: { periods: [{ open: { day: 0, hour: 0, minute: 0 } }] } })!;
  assert.equal(hoursLabel(always, "2026-11-10"), "Open 24 hours");
  assert.equal(checkHours(always, "2026-11-10", 1380, 1500).ok, true);
  const gone = parseGoogleHours({ businessStatus: "CLOSED_PERMANENTLY" })!;
  assert.equal(!checkHours(gone, "2026-11-10", 600, 700).ok && "closed", "closed");
  assert.equal(parseGoogleHours({ regularOpeningHours: { periods: [{ open: { day: 9, hour: 1 } }] } }), undefined, "bad data dropped");
  assert.equal(parseGoogleHours(undefined), undefined);
});
