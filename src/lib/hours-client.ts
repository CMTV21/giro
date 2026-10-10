"use client";

import { useEffect, useState } from "react";
import { normalizeCity } from "./destinations";
import { checkHours, hoursLabel, type OpeningHours } from "./hours";
import type { ScheduledItem } from "./schedule";
import type { Activity, Day, Trip } from "./types";

interface PlaceHours {
  hours?: OpeningHours;
  mapsUrl?: string;
}

export interface StopHours {
  /** Today's hours, e.g. "9:00 a.m. – 6:00 p.m.". */
  label: string;
  /** Set when the planned visit doesn't fit ("Closed on Mondays."). */
  issue?: string;
  mapsUrl?: string;
}

// Must match the server's hoursKey.
const keyOf = (title: string, city: string) => `${normalizeCity(title)}|${normalizeCity(city)}`.slice(0, 240);

/** Catalog sights and restaurants have hours worth checking; your own stops and placeholders don't. */
const checkable = (a: Activity) => Boolean(a.ref) && a.category !== "transit" && a.category !== "free";

const memo = new Map<string, PlaceHours>();

/** Opening hours for the trip's sights and restaurants (when the server has a Places key). */
export function useOpeningHours(trip: Trip) {
  const [, setVersion] = useState(0);
  const wanted = trip.days.flatMap((d) => d.activities.filter(checkable).map((a) => ({ title: a.title, city: d.city })));
  const missing = [...new Map(wanted.filter((w) => !memo.has(keyOf(w.title, w.city))).map((w) => [keyOf(w.title, w.city), w])).values()];
  const signature = missing.map((m) => keyOf(m.title, m.city)).join("|");

  useEffect(() => {
    if (!missing.length) return;
    let live = true;
    fetch("/api/hours", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: missing.slice(0, 40) }) })
      .then((r) => (r.ok ? r.json() : { hours: {} }))
      .then((j: { enabled?: boolean; hours?: Record<string, PlaceHours> }) => {
        // Remember answers (and that we asked), so each place is fetched once per page.
        for (const m of missing.slice(0, 40)) memo.set(keyOf(m.title, m.city), j.hours?.[keyOf(m.title, m.city)] ?? {});
        if (live) setVersion((v) => v + 1);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  return (a: Activity, day: Day, item?: Pick<ScheduledItem, "start" | "end">): StopHours | undefined => {
    if (!checkable(a)) return undefined;
    const found = memo.get(keyOf(a.title, day.city));
    if (!found?.hours) return undefined;
    const check = item ? checkHours(found.hours, day.date, item.start, item.end) : undefined;
    return { label: hoursLabel(found.hours, day.date), issue: check && !check.ok ? check.message : undefined, mapsUrl: found.mapsUrl };
  };
}
