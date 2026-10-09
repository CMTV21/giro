"use client";

import { CalendarCheck, ExternalLink, MapPin, Plus, Sparkles, Star, Trophy, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { mapsSearchUrl, reviewsLink, topRestaurantsLink, trackedHref } from "@/lib/booking";
import { recalcBudget, newId } from "@/lib/curate";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/dates";
import { foodFor, priceLabel, PRICE_USD, restaurantRef, restaurantToActivity, type Meal, type Restaurant } from "@/lib/food";
import { tripFx } from "@/lib/money";
import { addActivity } from "@/lib/plan-edit";
import type { Trip } from "@/lib/types";
import { PlacePhoto } from "./PlacePhoto";

const MEALS: { id: Meal | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
];

/** Must-try dishes and restaurants for each city, with live rankings and one-tap "add to a day". */
export function FoodPanel({ trip, readOnly, onChange, onMessage }: { trip: Trip; readOnly: boolean; onChange: (t: Trip) => void; onMessage: (m: string) => void }) {
  const cities = [...new Set(trip.days.map((d) => d.city))];
  const [city, setCity] = useState(cities[0]);
  const [meal, setMeal] = useState<Meal | "all">("all");
  const food = foodFor(trip, city);
  const fx = tripFx(trip);
  const days = trip.days.filter((d) => d.city === city);
  const restaurants = food.restaurants.filter((r) => meal === "all" || r.meal === meal);
  // Where each restaurant already sits in the plan, so we can say "Day 3" instead of offering it again.
  const planned = new Map<string, number>();
  for (const d of trip.days) for (const a of d.activities) if (a.ref?.startsWith("food:")) planned.set(a.ref, d.index);

  const add = (r: Restaurant, dayIndex: number) => {
    onChange(recalcBudget(addActivity(trip, dayIndex, restaurantToActivity(r, city, newId()))));
    onMessage(`${r.name} added to Day ${dayIndex + 1} for ${r.meal}.${r.meal === "breakfast" ? "" : ` It takes the place of the open ${r.meal} break in your schedule.`}`);
  };

  const top = trackedHref(topRestaurantsLink(city, fx.currency), trip.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Eat & drink</p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">What to eat in {city}</h2>
        </div>
        {cities.length > 1 && (
          <div role="tablist" aria-label="City" className="flex flex-wrap gap-1">
            {cities.map((c) => (
              <button key={c} role="tab" aria-selected={c === city} onClick={() => setCity(c)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${c === city ? "bg-ink text-white" : "bg-sand text-ink-soft hover:text-ink"}`}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {food.dishes.length > 0 && (
        <section aria-labelledby="dishes-title">
          <h3 id="dishes-title" className="flex items-center gap-2 text-lg font-semibold"><UtensilsCrossed className="h-5 w-5 text-brand" /> Must-try dishes</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {food.dishes.map((dish) => (
              <li key={dish.name} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
                <PlacePhoto title={dish.wiki ?? dish.name} city={city} className="h-20 w-20" />
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{dish.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{dish.what}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="restaurants-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="restaurants-title" className="flex items-center gap-2 text-lg font-semibold"><Trophy className="h-5 w-5 text-brand" /> Top restaurants</h3>
          <div className="flex flex-wrap gap-2">
            <a href={top} target="_blank" rel="noopener noreferrer" className="btn-ghost py-2 text-sm"><Star className="h-4 w-4" /> Live rankings on Tripadvisor <ExternalLink className="h-3.5 w-3.5" /></a>
            <a href={mapsSearchUrl(`restaurants in ${city}`)} target="_blank" rel="noopener noreferrer" className="btn-ghost py-2 text-sm"><MapPin className="h-4 w-4" /> Nearby on Google Maps</a>
          </div>
        </div>

        {food.restaurants.length > 0 ? (
          <>
            <p className="mt-1 text-sm text-muted">
              {food.source === "ai" ? "Suggested by Giro AI for this trip." : "Giro's picks: local institutions that have stood the test of time."} Add one to a day and Giro schedules it at the right meal.
            </p>
            <div className="mt-4 flex flex-wrap gap-1" role="group" aria-label="Meal">
              {MEALS.map((m) => (
                <button key={m.id} type="button" className="chip px-3 py-1 text-xs" aria-pressed={meal === m.id} onClick={() => setMeal(m.id)}>{m.label}</button>
              ))}
            </div>
            <ul className="mt-4 grid gap-3 lg:grid-cols-2">
              {restaurants.map((r) => {
                const inPlan = planned.get(restaurantRef(city, r));
                return (
                  <li key={r.name} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="font-semibold leading-snug">{r.name}</p>
                        <span className="text-sm font-semibold text-sea" title={`About ${formatMoney(PRICE_USD[r.price], fx, { approx: true })} per person`}>{priceLabel(r.price)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{r.kind} · {r.area} · Best for {r.meal}</p>
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{r.why}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {r.book && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900"><CalendarCheck className="h-3 w-3" /> Reserve ahead</span>}
                        <a href={trackedHref(reviewsLink(r.name, city, fx.currency), trip.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-ink-soft hover:bg-sand"><Star className="h-3.5 w-3.5" /> Reviews</a>
                        <a href={mapsSearchUrl(`${r.name}, ${r.area}, ${city}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-ink-soft hover:bg-sand"><MapPin className="h-3.5 w-3.5" /> Map</a>
                        {inPlan !== undefined ? (
                          <span className="ml-auto text-xs font-semibold text-sea">In your plan · Day {inPlan + 1}</span>
                        ) : (
                          !readOnly &&
                          days.length > 0 && (
                            <label className="ml-auto flex items-center gap-1 text-xs">
                              <Plus className="h-3.5 w-3.5 text-muted" />
                              <select className="rounded-lg border border-line bg-surface px-2 py-1 text-xs" value="" aria-label={`Add ${r.name} to a day`} onChange={(e) => e.target.value !== "" && add(r, Number(e.target.value))}>
                                <option value="">Add to…</option>
                                {days.map((d) => <option key={d.index} value={d.index}>Day {d.index + 1} · {formatDate(d.date, { weekday: "short", month: "short", day: "numeric" })}</option>)}
                              </select>
                            </label>
                          )
                        )}
                      </div>
                    </div>
                    <PlacePhoto title={r.name} city={city} query={{ strict: true }} className="h-20 w-24" />
                  </li>
                );
              })}
              {!restaurants.length && <li className="py-6 text-center text-sm text-muted lg:col-span-2">No picks for {meal} here yet. Try the live rankings above.</li>}
            </ul>
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-line px-5 py-8 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-brand" />
            <p className="mt-2 font-semibold">No curated food guide for {city} yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">Use the live rankings above, or regenerate this trip with Giro AI for a local food guide built for your budget.</p>
          </div>
        )}
        <p className="mt-4 text-xs text-muted">Restaurants change. Check opening hours, prices and recent reviews before you go. Price guide: $ under {formatMoney(25, fx)}, $$$$ {formatMoney(120, fx)}+ per person.</p>
      </section>
    </div>
  );
}
