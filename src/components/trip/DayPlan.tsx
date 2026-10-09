"use client";

import { Navigation, Plus, Shuffle, UtensilsCrossed, X } from "lucide-react";
import { Fragment, useState } from "react";
import { mapsRouteUrl } from "@/lib/booking";
import { suggestAlternatives, newId } from "@/lib/curate";
import { formatDate } from "@/lib/dates";
import { money, tripFx } from "@/lib/money";
import type { VoteTally } from "@/lib/storage";
import { loadTaste, recordSignal } from "@/lib/taste-client";
import type { Activity, Day, Slot, Trip } from "@/lib/types";
import { ActivityCard } from "./ActivityCard";

export interface DayGroupProps {
  votes?: Record<string, VoteTally>;
  onVote?: (activityId: string, value: -1 | 0 | 1) => void;
  readOnly?: boolean;
}

export function DayPlan({ trip, day, onChange, votes, onVote, readOnly }: { trip: Trip; day: Day; onChange: (day: Day) => void } & DayGroupProps) {
  const [swapping, setSwapping] = useState<string>();
  const [adding, setAdding] = useState(false);

  const update = (activities: Activity[]) => onChange({ ...day, activities });
  const stops = day.activities.filter((a) => a.category !== "transit" && a.area).map((a) => `${a.category === "free" ? a.area : a.title}, ${day.city}`);
  const route = mapsRouteUrl(stops);

  return (
    <article id={`day-${day.index + 1}`} className="scroll-mt-28">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Day {day.index + 1} · {formatDate(day.date)}</p>
          <h3 className="mt-1 font-display text-2xl font-semibold sm:text-[1.7rem]">{day.theme}</h3>
          <p className="text-sm text-muted">{day.city}</p>
        </div>
        {route && (
          <a href={route} target="_blank" rel="noopener noreferrer" className="btn-ghost no-print px-3.5 py-2 text-xs">
            <Navigation className="h-3.5 w-3.5" /> Day route in Maps
          </a>
        )}
      </header>

      <ol>
        {day.activities.map((a, i) => (
          <Fragment key={a.id}>
            <ActivityCard
              activity={a}
              city={day.city}
              fx={tripFx(trip)}
              tripId={trip.id}
              actions={{
                canMoveUp: i > 0,
                canMoveDown: i < day.activities.length - 1,
                onMove: (dir) => {
                  const next = [...day.activities];
                  const j = i + dir;
                  [next[i], next[j]] = [next[j], next[i]];
                  // Keep slot labels in chronological order after a reorder.
                  const slots = day.activities.map((x) => x.slot);
                  update(next.map((x, k) => ({ ...x, slot: slots[k] })));
                },
                onRemove: () => {
                  recordSignal("removed", a.category);
                  update(day.activities.filter((x) => x.id !== a.id));
                },
                onToggleBooked: () => {
                  if (!a.booked) recordSignal("booked", a.category);
                  update(day.activities.map((x) => (x.id === a.id ? { ...x, booked: !x.booked } : x)));
                },
                onSwap: a.category === "transit" ? undefined : () => setSwapping(swapping === a.id ? undefined : a.id),
                readOnly,
                votes: votes?.[a.id],
                onVote: onVote
                  ? (value) => {
                      if (value !== 0) recordSignal(value > 0 ? "voted_up" : "voted_down", a.category);
                      onVote(a.id, value);
                    }
                  : undefined,
              }}
            />
            {swapping === a.id && (
              <SwapPanel
                trip={trip}
                day={day}
                slot={a.slot}
                onClose={() => setSwapping(undefined)}
                onPick={(alt) => {
                  recordSignal("swapped_out", a.category);
                  recordSignal("swapped_in", alt.category);
                  update(day.activities.map((x) => (x.id === a.id ? alt : x)));
                  setSwapping(undefined);
                }}
              />
            )}
          </Fragment>
        ))}
      </ol>

      {day.eat && (
        <p className="mb-4 ml-14 flex gap-2 text-sm text-ink-soft">
          <UtensilsCrossed className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <span><span className="font-semibold text-ink">Eat:</span> {day.eat}</span>
        </p>
      )}

      {!readOnly && <div className="no-print ml-14">
        {adding ? (
          <AddStop
            onCancel={() => setAdding(false)}
            onAdd={(a) => {
              const order: Record<Slot, number> = { morning: 0, afternoon: 1, evening: 2 };
              update([...day.activities, a].sort((x, y) => order[x.slot] - order[y.slot]));
              setAdding(false);
            }}
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand hover:text-ink">
            <Plus className="h-4 w-4" /> Add a stop
          </button>
        )}
      </div>}
    </article>
  );
}

function SwapPanel({ trip, day, slot, onPick, onClose }: { trip: Trip; day: Day; slot: Slot; onPick: (a: Activity) => void; onClose: () => void }) {
  const alternatives = suggestAlternatives(trip, day.index, slot, 4, loadTaste());
  return (
    <li className="mb-5 ml-14 rounded-2xl border border-ink/10 bg-sand/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold"><Shuffle className="h-4 w-4" /> Swap for…</p>
        <button type="button" aria-label="Close" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full hover:bg-surface"><X className="h-4 w-4" /></button>
      </div>
      {alternatives.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {alternatives.map((alt) => (
            <li key={alt.id}>
              <button type="button" onClick={() => onPick(alt)} className="h-full w-full rounded-xl border border-line bg-surface p-3 text-left transition hover:border-ink/30 hover:shadow-card">
                <span className="block text-sm font-semibold">{alt.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{alt.description}</span>
                <span className="mt-1.5 block text-xs font-medium text-ink-soft">{alt.area} · {alt.durationHrs}h · {alt.estCost ? money(trip, alt.estCost, true) : "Free"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">You've already got our best picks for this slot. Add your own stop below.</p>
      )}
    </li>
  );
}

function AddStop({ onAdd, onCancel }: { onAdd: (a: Activity) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [slot, setSlot] = useState<Slot>("afternoon");
  const [area, setArea] = useState("");
  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd({ id: newId(), title: title.trim(), description: "Added by you.", category: "culture", slot, durationHrs: 2, estCost: 0, area: area.trim() || undefined });
      }}
    >
      <input autoFocus className="field py-2" placeholder="What do you want to do?" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Stop name" />
      <input className="field py-2 sm:max-w-40" placeholder="Area (optional)" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area" />
      <select className="field py-2 sm:max-w-36" value={slot} onChange={(e) => setSlot(e.target.value as Slot)} aria-label="Time of day">
        <option value="morning">Morning</option>
        <option value="afternoon">Afternoon</option>
        <option value="evening">Evening</option>
      </select>
      <div className="flex gap-2">
        <button type="submit" className="btn-dark py-2">Add</button>
        <button type="button" className="btn-ghost py-2" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
