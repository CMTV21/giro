"use client";

import { CloudRain, Clock, CloudSun, Navigation, Shuffle, Sun, Ticket, Timer, Umbrella } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { experienceLinks, trackedHref } from "@/lib/booking";
import { recalcBudget, suggestAlternatives } from "@/lib/curate";
import { formatDate, toISODate } from "@/lib/dates";
import { dayForDate, exposure, lightestLaterDay, moveActivity, nowAndNext, rainRisks, slotRain, weatherLabel } from "@/lib/live";
import { money } from "@/lib/money";
import { loadTaste, recordSignal } from "@/lib/taste-client";
import type { Activity, Trip } from "@/lib/types";
import type { DayForecast, Forecast } from "@/lib/weather";
import { CATEGORY_META } from "../meta";

const forecasts = new Map<string, Promise<Forecast | undefined>>();
function getForecast(city: string) {
  if (!forecasts.has(city)) {
    forecasts.set(
      city,
      fetch(`/api/weather?city=${encodeURIComponent(city)}`)
        .then((r) => (r.ok ? (r.json() as Promise<Forecast>) : undefined))
        .catch(() => undefined),
    );
  }
  return forecasts.get(city)!;
}

const directions = (place: string, city: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place}, ${city}`)}&travelmode=walking`;

export function LivePanel({ trip, readOnly, onChange }: { trip: Trip; readOnly: boolean; onChange: (t: Trip) => void }) {
  const [clock, setClock] = useState<Date>();
  const [picked, setPicked] = useState<number>();
  const [weather, setWeather] = useState<DayForecast | null>();

  useEffect(() => {
    setClock(new Date());
    const t = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const todayISO = clock ? toISODate(new Date(clock.getTime() - clock.getTimezoneOffset() * 60_000)) : undefined;
  const today = todayISO ? dayForDate(trip, todayISO) : undefined;
  const live = Boolean(today) && picked === undefined;
  const day = trip.days[picked ?? today?.index ?? 0];

  useEffect(() => {
    if (!day) return;
    setWeather(undefined);
    getForecast(day.city).then((f) => setWeather(f?.days.find((d) => d.date === day.date) ?? null));
  }, [day?.city, day?.date, day]);

  const hour = clock?.getHours() ?? 9;
  const { now, next } = useMemo(() => (day && live ? nowAndNext(day, hour) : { now: undefined, next: day?.activities.find((a) => a.category !== "free") }), [day, hour, live]);
  const risks = day && weather ? rainRisks(day, weather.hourlyRain) : [];
  const later = day ? lightestLaterDay(trip, day.index) : undefined;

  if (!day || !clock) return <div className="h-64 animate-pulse rounded-3xl bg-sand" />;

  const swap = (from: Activity, to: Activity) => {
    recordSignal("swapped_out", from.category);
    recordSignal("swapped_in", to.category);
    onChange(recalcBudget({ ...trip, days: trip.days.map((d) => (d.index === day.index ? { ...d, activities: d.activities.map((a) => (a.id === from.id ? { ...to, slot: from.slot } : a)) } : d)) }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{live ? "Live · today" : "Preview a day"}</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">{day.city}, {formatDate(day.date)}</h2>
          <p className="text-sm text-muted">Day {day.index + 1} · {day.theme}</p>
        </div>
        <select aria-label="Choose a day" className="field w-auto py-2" value={day.index} onChange={(e) => setPicked(Number(e.target.value) === today?.index ? undefined : Number(e.target.value))}>
          {trip.days.map((d) => (
            <option key={d.index} value={d.index}>Day {d.index + 1} · {formatDate(d.date, { month: "short", day: "numeric" })}{d.index === today?.index ? " (today)" : ""}</option>
          ))}
        </select>
      </div>

      <WeatherCard weather={weather} />

      {!readOnly && risks.length > 0 && (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-sky-900"><Umbrella className="h-4 w-4" /> Rain plan</h3>
          <ul className="mt-3 space-y-4">
            {risks.map(({ activity, chance }) => {
              const indoor = suggestAlternatives(trip, day.index, activity.slot, 8, loadTaste()).filter((a) => exposure(a) === "indoor").slice(0, 2);
              return (
                <li key={activity.id}>
                  <p className="text-sm text-sky-900"><span className="font-semibold">{chance}% chance of rain</span> during {activity.title} ({activity.slot}).</p>
                  {indoor.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {indoor.map((alt) => (
                        <button key={alt.id} type="button" onClick={() => swap(activity, alt)} className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-white px-3 py-1.5 text-sm font-medium text-sky-900 hover:border-sky-500">
                          <Shuffle className="h-3.5 w-3.5" /> Swap for {alt.title}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-sky-800">Pack a rain jacket. No indoor swaps left in this city.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <MomentCard label={live ? "Now" : "First up"} activity={live ? now : next} city={day.city} trip={trip} wet={weather ? (a) => slotRain(weather.hourlyRain, a.slot) : undefined}>
          {live && now && !readOnly && later && now.category !== "transit" && (
            <button
              type="button"
              className="btn-ghost mt-4 py-2 text-xs"
              onClick={() => {
                if (confirm(`Move "${now.title}" to Day ${later.index + 1}?`)) onChange(recalcBudget(moveActivity(trip, day.index, now.id, later.index)));
              }}
            >
              <Timer className="h-3.5 w-3.5" /> Running late? Move it to Day {later.index + 1}
            </button>
          )}
        </MomentCard>
        <MomentCard label={live ? "Up next" : "Then"} activity={live ? next : day.activities.filter((a) => a.category !== "free")[1]} city={day.city} trip={trip} wet={weather ? (a) => slotRain(weather.hourlyRain, a.slot) : undefined} />
      </div>

      <section className="card p-5">
        <h3 className="font-semibold">The day at a glance</h3>
        <ol className="mt-3 divide-y divide-line">
          {day.activities.map((a) => {
            const meta = CATEGORY_META[a.category] ?? CATEGORY_META.free;
            const Icon = meta.icon;
            const past = live && ["morning", "afternoon", "evening"].indexOf(a.slot) < ["morning", "afternoon", "evening"].indexOf(now?.slot ?? "morning");
            return (
              <li key={a.id} className={`flex items-center gap-3 py-2.5 ${past ? "opacity-50" : ""}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${meta.tone}`}><Icon className="h-4 w-4" /></span>
                <span className="w-20 shrink-0 text-xs font-semibold text-muted uppercase">{a.slot}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                {a.id === now?.id && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">Now</span>}
              </li>
            );
          })}
        </ol>
        {day.eat && <p className="mt-3 text-sm text-ink-soft"><span className="font-semibold text-ink">Eat:</span> {day.eat}</p>}
      </section>
    </div>
  );
}

function WeatherCard({ weather }: { weather: DayForecast | null | undefined }) {
  if (weather === undefined) return <div className="h-20 animate-pulse rounded-2xl bg-sand" />;
  if (weather === null) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
        <CloudSun className="h-4 w-4" /> The forecast appears here about two weeks before this day, along with a rain plan if you need one.
      </p>
    );
  }
  const Icon = weather.rain >= 55 ? CloudRain : weather.code <= 1 ? Sun : CloudSun;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface px-5 py-4">
      <Icon className="h-8 w-8 text-brand" />
      <div>
        <p className="font-semibold">{weatherLabel(weather.code)}</p>
        <p className="text-sm text-muted">{Math.round(weather.tmax)}° / {Math.round(weather.tmin)}°C</p>
      </div>
      <p className="text-sm"><span className="font-semibold">{weather.rain}%</span> <span className="text-muted">chance of rain</span></p>
    </div>
  );
}

function MomentCard({ label, activity, city, trip, wet, children }: { label: string; activity?: Activity; city: string; trip: Trip; wet?: (a: Activity) => number; children?: React.ReactNode }) {
  if (!activity) {
    return (
      <div className="card p-5">
        <p className="eyebrow">{label}</p>
        <p className="mt-2 text-ink-soft">Nothing scheduled. Enjoy the free time.</p>
      </div>
    );
  }
  const ticket = activity.bookable ? experienceLinks(city, activity.title, trip.fx?.currency)[0] : undefined;
  const chance = wet?.(activity) ?? 0;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <span className="flex items-center gap-1 text-xs text-muted"><Clock className="h-3.5 w-3.5" /> {activity.slot} · {activity.durationHrs}h</span>
      </div>
      <h3 className="mt-2 text-xl font-semibold">{activity.title}</h3>
      <p className="mt-1 text-sm text-ink-soft">{activity.description}</p>
      {activity.tip && <p className="mt-2 text-sm text-ink-soft"><span className="font-semibold">Tip:</span> {activity.tip}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {activity.category !== "transit" && (
          <a className="btn-dark py-2 text-xs" href={directions(activity.category === "free" ? activity.area ?? city : activity.title, city)} target="_blank" rel="noopener noreferrer">
            <Navigation className="h-3.5 w-3.5" /> Directions
          </a>
        )}
        {ticket && (
          <a className="btn-ghost py-2 text-xs" href={trackedHref({ ...ticket, valueUSD: activity.estCost }, trip.id)} target="_blank" rel="noopener noreferrer sponsored">
            <Ticket className="h-3.5 w-3.5" /> Tickets{activity.estCost ? ` · ${money(trip, activity.estCost, true)}` : ""}
          </a>
        )}
        {chance >= 55 && exposure(activity) === "outdoor" && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900"><Umbrella className="h-3.5 w-3.5" /> {chance}% rain</span>}
      </div>
      {children}
    </div>
  );
}
