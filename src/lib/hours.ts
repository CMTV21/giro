import { clock } from "./schedule.ts";

/**
 * Opening hours (Google Places "regularOpeningHours") and checks against a planned visit.
 * Days are 0 = Sunday … 6 = Saturday; times are local to the place.
 */

export interface HoursPoint {
  day: number;
  hour: number;
  minute: number;
}

export interface OpeningHours {
  /** No close means open 24 hours from that point. */
  periods: { open: HoursPoint; close?: HoursPoint }[];
  /** Permanently or temporarily closed, per the provider. */
  closed?: "permanently" | "temporarily";
}

export type HoursCheck =
  | { ok: true; opens: number; closes: number }
  | { ok: false; kind: "closed_day" | "opens_later" | "closes_earlier" | "closed_down"; message: string; opens?: number; closes?: number };

const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const WEEK = 7 * 1440;

const weekMinute = (p: HoursPoint) => p.day * 1440 + p.hour * 60 + p.minute;

/** Weekday of an ISO date (YYYY-MM-DD), 0 = Sunday. */
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Open intervals touching a day, as minutes from that day's midnight (may run past 1440). */
export function intervalsOn(hours: OpeningHours, weekday: number): { opens: number; closes: number }[] {
  const dayStart = weekday * 1440;
  const out: { opens: number; closes: number }[] = [];
  for (const p of hours.periods) {
    if (!p.close) {
      // Open around the clock (a single open period with no close).
      out.push({ opens: 0, closes: 2 * 1440 });
      continue;
    }
    const o = weekMinute(p.open);
    let c = weekMinute(p.close);
    if (c <= o) c += WEEK; // runs past Saturday night
    for (const shift of [-WEEK, 0]) {
      const so = o + shift;
      const sc = c + shift;
      if (sc > dayStart && so < dayStart + 1440) out.push({ opens: Math.max(0, so - dayStart), closes: sc - dayStart });
    }
  }
  return out.sort((a, b) => a.opens - b.opens);
}

/** Does a visit from `start` to `end` (minutes from midnight) on `date` fit the opening hours? */
export function checkHours(hours: OpeningHours, date: string, start: number, end: number): HoursCheck {
  if (hours.closed === "permanently") return { ok: false, kind: "closed_down", message: "Permanently closed, according to Google." };
  if (hours.closed === "temporarily") return { ok: false, kind: "closed_down", message: "Temporarily closed, according to Google." };
  if (!hours.periods.length) return { ok: true, opens: 0, closes: 1440 };
  const weekday = weekdayOf(date);
  const open = intervalsOn(hours, weekday);
  if (!open.length) return { ok: false, kind: "closed_day", message: `Closed on ${WEEKDAYS[weekday]}.` };
  const containing = open.find((i) => i.opens <= start && end <= i.closes);
  if (containing) return { ok: true, opens: containing.opens, closes: containing.closes };
  // The interval the visit starts in (or the next one that day).
  const during = open.find((i) => i.opens <= start && start < i.closes);
  if (during) return { ok: false, kind: "closes_earlier", message: `Closes at ${clock(during.closes % 1440)}, before this ends.`, opens: during.opens, closes: during.closes };
  const next = open.find((i) => i.opens > start);
  if (next) return { ok: false, kind: "opens_later", message: `Opens at ${clock(next.opens)}.`, opens: next.opens, closes: next.closes };
  const last = open.at(-1)!;
  return { ok: false, kind: "closes_earlier", message: `Closes at ${clock(last.closes % 1440)}.`, opens: last.opens, closes: last.closes };
}

/** "9:00 a.m. – 6:00 p.m.", "Open 24 hours" or "Closed" for a date. */
export function hoursLabel(hours: OpeningHours, date: string): string {
  const open = intervalsOn(hours, weekdayOf(date));
  if (!open.length) return "Closed";
  if (open.length === 1 && open[0].opens === 0 && open[0].closes >= 1440) return "Open 24 hours";
  return open.map((i) => `${clock(i.opens)} – ${clock(i.closes % 1440)}`).join(", ");
}

const isPoint = (v: unknown): v is HoursPoint => {
  const p = v as HoursPoint;
  return !!p && Number.isInteger(p.day) && p.day >= 0 && p.day <= 6 && Number.isInteger(p.hour) && p.hour >= 0 && p.hour <= 24 && Number.isInteger(p.minute ?? 0);
};

/** Google Places (New) place → OpeningHours; undefined when it has no usable hours. */
export function parseGoogleHours(place: unknown): OpeningHours | undefined {
  const p = place as { businessStatus?: string; regularOpeningHours?: { periods?: { open?: unknown; close?: unknown }[] } } | undefined;
  if (!p) return undefined;
  const closed = p.businessStatus === "CLOSED_PERMANENTLY" ? "permanently" : p.businessStatus === "CLOSED_TEMPORARILY" ? "temporarily" : undefined;
  const periods = (p.regularOpeningHours?.periods ?? [])
    .filter((x) => isPoint(x.open) && (x.close === undefined || isPoint(x.close)))
    .map((x) => {
      const open = x.open as HoursPoint;
      const close = x.close as HoursPoint | undefined;
      const o = { day: open.day, hour: open.hour, minute: open.minute ?? 0 };
      return close ? { open: o, close: { day: close.day, hour: close.hour, minute: close.minute ?? 0 } } : { open: o };
    });
  if (!periods.length && !closed) return undefined;
  return closed ? { periods, closed } : { periods };
}
