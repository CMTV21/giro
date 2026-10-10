"use client";

import { CalendarPlus, ExternalLink, Music } from "lucide-react";
import { useEffect, useState } from "react";
import { placeAtTime } from "@/lib/board";
import { trackedHref } from "@/lib/booking";
import { isCurrency } from "@/lib/currency";
import { newId } from "@/lib/curate";
import { formatDate } from "@/lib/dates";
import { eventCategory, type TripEvent } from "@/lib/events";
import { tripFx } from "@/lib/money";
import { customStop } from "@/lib/plan-edit";
import { clock, toMinutes } from "@/lib/schedule";
import type { Trip } from "@/lib/types";

type CityEvents = { city: string; events: TripEvent[] };

/** Concerts, games and shows on during the trip, with tickets and one tap to add to the right day. */
export function EventsCard({ trip, readOnly, onChange, onMessage }: { trip: Trip; readOnly: boolean; onChange: (t: Trip) => void; onMessage: (m: string) => void }) {
  const [groups, setGroups] = useState<CityEvents[]>();
  const [showAll, setShowAll] = useState(false);
  const legs = trip.stays.map((s) => ({ city: s.city, start: s.checkIn, end: s.checkOut }));
  const key = legs.map((l) => `${l.city}:${l.start}:${l.end}`).join("|");

  useEffect(() => {
    let live = true;
    Promise.all(
      legs.map((l) =>
        fetch(`/api/events?${new URLSearchParams(l)}`)
          .then((r) => (r.ok ? r.json() : { events: [] }))
          .then((j: { events?: TripEvent[] }) => ({ city: l.city, events: j.events ?? [] }))
          .catch(() => ({ city: l.city, events: [] as TripEvent[] })),
      ),
    ).then((g) => live && setGroups(g));
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = (groups ?? []).flatMap((g) => g.events.map((e) => ({ ...e, city: g.city }))).sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`));
  if (!all.length) return null;
  const fx = tripFx(trip);
  const shown = showAll ? all : all.slice(0, 5);
  const planned = new Set(trip.days.flatMap((d) => d.activities.map((a) => a.title)));

  const add = (e: TripEvent & { city: string }) => {
    const day = trip.days.find((d) => d.date === e.date && d.city === e.city);
    if (!day) return;
    const minutes = (e.time && toMinutes(e.time)) || 19 * 60;
    const priceUSD = e.priceMin && e.currency === fx.currency && isCurrency(e.currency) ? e.priceMin / (fx.rate || 1) : 0;
    const stop = customStop(
      {
        title: e.name,
        description: [e.genre ?? e.segment, e.venue && `at ${e.venue}`].filter(Boolean).join(" "),
        category: eventCategory(e),
        slot: minutes < 12 * 60 ? "morning" : minutes < 18 * 60 ? "afternoon" : "evening",
        durationHrs: 2.5,
        estCost: Math.round(priceUSD),
        area: e.venue,
        tip: "Tickets on Ticketmaster; check the start time on your ticket.",
      },
      newId(),
    );
    const r = placeAtTime(trip, { kind: "new", activity: stop }, day.index, minutes);
    if (r.error) return onMessage(r.error);
    onChange(r.trip);
    onMessage(`Added ${e.name} to day ${day.index + 1} at ${clock(minutes)}.`);
  };

  return (
    <section aria-labelledby="events-title" className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h3 id="events-title" className="flex items-center gap-2 font-semibold"><Music className="h-4 w-4 text-brand" /> On during your trip</h3>
      <ul className="mt-3 divide-y divide-line">
        {shown.map((e) => {
          const day = trip.days.find((d) => d.date === e.date && d.city === e.city);
          const price = e.priceMin && e.currency ? `from ${new Intl.NumberFormat("en-CA", { style: "currency", currency: e.currency, maximumFractionDigits: 0 }).format(e.priceMin)}` : undefined;
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
              <div className="w-24 shrink-0 text-xs text-muted">
                <p className="font-semibold text-ink-soft">{formatDate(e.date, { weekday: "short", month: "short", day: "numeric" })}</p>
                {e.time && <p>{clock(toMinutes(e.time)!)}</p>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" title={e.name}>{e.name}</p>
                <p className="truncate text-xs text-muted">{[e.venue, e.genre ?? e.segment, price, legs.length > 1 ? e.city : undefined].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="flex gap-1.5">
                <a href={trackedHref({ url: e.url, provider: "Ticketmaster", kind: "events" }, trip.id)} target="_blank" rel="noopener noreferrer sponsored" className="btn-ghost px-3 py-1.5 text-xs">Tickets <ExternalLink className="h-3 w-3" /></a>
                {!readOnly && day && (planned.has(e.name) ? (
                  <span className="px-2 py-1.5 text-xs font-semibold text-sea">In your plan</span>
                ) : (
                  <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => add(e)}><CalendarPlus className="h-3.5 w-3.5" /> Day {day.index + 1}</button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      {all.length > 5 && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 text-xs font-semibold text-ink-soft hover:text-ink">{showAll ? "Show fewer" : `Show all ${all.length}`}</button>
      )}
      <p className="mt-2 text-xs text-muted">Listings from Ticketmaster. Dates and prices can change; check before you buy.</p>
    </section>
  );
}
