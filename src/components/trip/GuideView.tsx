"use client";

import { ArrowLeft, BedDouble, Lightbulb, Plane, Printer, StickyNote, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDate, formatRange } from "@/lib/dates";
import { foodFor } from "@/lib/food";
import { clock, dayWindow, scheduleDay, type ScheduledItem } from "@/lib/schedule";
import { fetchTrip } from "@/lib/storage";
import { mapStops, resolveStops, stayFor, stayPoint, type MapStop, type ResolvedStop } from "@/lib/stops-client";
import type { Day, Trip } from "@/lib/types";
import { HeadsUpCard, headsUpFor } from "./HeadsUp";
import { LeafletMap } from "./DayMap";
import { PlaceStory } from "./PlaceFacts";

interface GuideDay {
  day: Day;
  items: ScheduledItem[];
  notes: string[];
  stops: ResolvedStop[];
  pins: MapStop[];
  home?: { lat: number; lon: number; name: string };
}

/** Printable day-by-day sightseeing guide: map, timed schedule and the story of every stop. */
export function GuideView() {
  const { id } = useParams<{ id: string }>();
  const only = Number(useSearchParams().get("day")) || undefined;
  const [trip, setTrip] = useState<Trip | null>();
  const [days, setDays] = useState<GuideDay[]>();

  useEffect(() => {
    fetchTrip(id)
      .then((b) => setTrip(b?.trip ?? null))
      .catch(() => setTrip(null));
  }, [id]);

  useEffect(() => {
    if (!trip) return;
    const chosen = only ? trip.days.filter((d) => d.index === only - 1) : trip.days;
    Promise.all(
      chosen.map(async (day) => {
        const w = dayWindow(trip, day);
        const items = scheduleDay(trip, day, w);
        const stops = await resolveStops(day, items, { facts: true });
        return { day, items, notes: w.notes, stops, pins: mapStops(stops), home: await stayPoint(stayFor(trip, day)) };
      }),
    ).then(setDays);
  }, [trip, only]);

  if (trip === undefined) return <div className="mx-auto h-[60vh] max-w-4xl animate-pulse px-4 py-10"><div className="h-64 rounded-3xl bg-sand" /></div>;
  if (trip === null) return <p className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Trip not found. <Link href="/trips" className="text-brand underline">Your trips</Link></p>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/trip/${trip.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to trip</Link>
        <div className="flex flex-wrap items-center gap-2">
          <select className="field w-auto py-2 text-sm" value={only ?? ""} aria-label="Which day" onChange={(e) => { const v = e.target.value; window.location.search = v ? `?day=${v}` : ""; }}>
            <option value="">Whole trip</option>
            {trip.days.map((d) => <option key={d.index} value={d.index + 1}>Day {d.index + 1} · {formatDate(d.date, { month: "short", day: "numeric" })}</option>)}
          </select>
          <button type="button" className="btn-primary" disabled={!days} onClick={() => window.print()}><Printer className="h-4 w-4" /> {days ? "Print or save as PDF" : "Preparing…"}</button>
        </div>
      </div>

      <header className="mb-8 border-b border-line pb-6">
        <p className="eyebrow">Sightseeing guide</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{trip.title}</h1>
        <p className="mt-1 text-ink-soft">{formatRange(trip.request.startDate, trip.request.endDate)}</p>
        {trip.notes && !only && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm whitespace-pre-line text-amber-950">
            <p className="mb-1 text-xs font-semibold tracking-wide text-amber-800 uppercase">Trip notes</p>
            {trip.notes}
          </div>
        )}
      </header>

      {!days ? (
        <p className="animate-pulse text-muted">Gathering maps, history and facts for each stop…</p>
      ) : (
        days.map((g, i) => <GuideDaySection key={g.day.index} g={g} trip={trip} firstInCity={i === 0 || days[i - 1].day.city !== g.day.city} />)
      )}

      <footer className="mt-10 border-t border-line pt-4 text-[11px] text-muted">
        Place descriptions from Wikipedia (CC BY-SA 4.0). Map data © OpenStreetMap contributors. Times are estimates; check opening hours before you go. Made with Giro.
      </footer>
    </div>
  );
}

function GuideDaySection({ g, trip, firstInCity }: { g: GuideDay; trip: Trip; firstInCity: boolean }) {
  const stay = stayFor(trip, g.day);
  const dishes = firstInCity ? foodFor(trip, g.day.city).dishes : [];
  let n = 0;
  return (
    <section className="guide-day mb-12">
      <p className="eyebrow">Day {g.day.index + 1} · {formatDate(g.day.date, { weekday: "long", month: "long", day: "numeric" })}</p>
      <h2 className="mt-1 font-display text-3xl font-semibold">{g.day.theme}</h2>
      <p className="text-sm text-muted">{g.day.city}{stay?.booking ? ` · Staying at ${stay.booking.name}${stay.booking.address ? `, ${stay.booking.address}` : ""}` : ` · Base: ${stay?.area ?? ""}`}</p>

      {g.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-sky-900">
          {g.notes.map((note) => <li key={note} className="flex gap-2"><Plane className="mt-0.5 h-4 w-4 shrink-0" />{note}</li>)}
        </ul>
      )}

      {g.pins.length + (g.home ? 1 : 0) > 0 && (
        <div className="mt-4">
          <LeafletMap stops={g.pins} home={g.home} height={280} interactive={false} />
        </div>
      )}

      <table className="mt-5 w-full text-sm">
        <tbody className="divide-y divide-line">
          {g.items.map((it) => {
            const num = it.kind === "activity" && it.activity!.category !== "transit" && it.activity!.category !== "free" ? ++n : undefined;
            return (
              <tr key={`${it.kind}-${it.start}-${it.label}`} className="align-top">
                <td className="w-28 py-2 pr-3 font-semibold whitespace-nowrap text-ink-soft tabular-nums">{clock(it.start)}</td>
                <td className="py-2">
                  <span className="inline-flex items-center gap-2">
                    {num !== undefined ? <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">{num}</span> : it.kind === "meal" ? <UtensilsCrossed className="h-4 w-4 text-brand" /> : it.kind === "flight" ? <Plane className="h-4 w-4 text-sky-700" /> : <BedDouble className="h-4 w-4 text-sea" />}
                    <span className="font-medium">{it.label}{it.kind === "meal" && it.label === "Dinner" && g.day.eat ? ` · ${g.day.eat}` : ""}</span>
                  </span>
                </td>
                <td className="hidden py-2 pl-3 text-right text-muted sm:table-cell">{it.activity?.area}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ol className="mt-6 space-y-5">
        {g.stops.map((s, i) => {
          const a = s.item.activity!;
          return (
            <li key={a.id} className="break-inside-avoid rounded-2xl border border-line p-4">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">{i + 1}</span>
                {clock(s.item.start)} – {clock(s.item.end)}{a.area ? ` · ${a.area}` : ""}
              </p>
              <h3 className="mt-1.5 text-lg font-semibold">{a.title}</h3>
              {a.description && a.description !== "Added by you." && <p className="mt-1 text-ink-soft">{a.description}</p>}
              {a.note && <p className="mt-2 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm whitespace-pre-line text-amber-950"><StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{a.note}</p>}
              {a.tip && <p className="mt-2 flex gap-2 text-sm text-ink-soft"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{a.tip}</p>}
              {s.info.extract && (
                <div className="mt-3 border-t border-line pt-3 text-sm">
                  <PlaceStory info={s.info} />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {firstInCity && headsUpFor([g.day.city]).length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-200 p-4">
          <HeadsUpCard cities={[g.day.city]} compact />
        </div>
      )}

      {dishes.length > 0 && (
        <div className="mt-6 break-inside-avoid rounded-2xl bg-sand/60 p-4">
          <h3 className="flex items-center gap-2 font-semibold"><UtensilsCrossed className="h-4 w-4 text-brand" /> Taste of {g.day.city}</h3>
          <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {dishes.map((d) => <li key={d.name}><span className="font-semibold">{d.name}</span> <span className="text-ink-soft">· {d.what}</span></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
