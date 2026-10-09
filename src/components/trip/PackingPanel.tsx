"use client";

import { Backpack, Check, Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";
import type { Trip } from "@/lib/types";

// Packing is personal, even on a shared trip, so ticks live with each traveller rather than in the trip.
const key = (tripId: string) => `giro.packed.${tripId}`;

function loadPacked(trip: Trip): string[] {
  try {
    const raw = localStorage.getItem(key(trip.id));
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* storage unavailable */
  }
  return trip.packed ?? [];
}

export function PackingPanel({ trip }: { trip: Trip; onChange?: (t: Trip) => void }) {
  const [packed, setPacked] = useState<Set<string>>(new Set());
  useEffect(() => setPacked(new Set(loadPacked(trip))), [trip]);

  const toggle = (item: string) => {
    const next = new Set(packed);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setPacked(next);
    try {
      localStorage.setItem(key(trip.id), JSON.stringify([...next]));
    } catch {
      /* storage unavailable */
    }
  };
  const done = trip.packing.filter((p) => packed.has(p)).length;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold"><Backpack className="h-4 w-4" /> Packing list</h3>
          <span className="text-sm text-muted tabular-nums">{done}/{trip.packing.length} packed</span>
        </div>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-sea transition-all" style={{ width: `${trip.packing.length ? (done / trip.packing.length) * 100 : 0}%` }} />
        </div>
        <ul className="space-y-1">
          {trip.packing.map((item) => {
            const on = packed.has(item);
            return (
              <li key={item}>
                <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(item)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[15px] transition hover:bg-sand/60">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${on ? "border-sea bg-sea text-white" : "border-line bg-surface"}`}>
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  <span className={on ? "text-muted line-through" : ""}>{item}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="card p-5 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold"><Lightbulb className="h-4 w-4" /> Good to know</h3>
        <ul className="space-y-3">
          {trip.tips.map((tip) => (
            <li key={tip} className="flex gap-3 text-[15px] leading-relaxed text-ink-soft">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              {tip}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
