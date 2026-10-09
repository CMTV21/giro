"use client";

import { useState } from "react";
import { inspire } from "@/lib/curate";
import { DESTINATIONS } from "@/lib/destinations";
import { INTERESTS, type Interest } from "@/lib/types";
import { DestinationCard } from "./DestinationCard";
import { INTEREST_META } from "./meta";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function ExploreGrid() {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [month, setMonth] = useState<number>(0);
  const filtered = interests.length || month;
  const list = filtered ? inspire(interests, month || undefined, DESTINATIONS.length) : DESTINATIONS;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const { label, icon: Icon } = INTEREST_META[i];
            const on = interests.includes(i);
            return (
              <button key={i} type="button" className="chip" aria-pressed={on} onClick={() => setInterests(on ? interests.filter((x) => x !== i) : [...interests, i])}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            );
          })}
        </div>
        <select aria-label="Travel month" className="field max-w-52 py-2 lg:ml-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          <option value={0}>Any month</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((d) => <DestinationCard key={d.slug} d={d} />)}
      </div>
      <p className="text-sm text-muted">Don&apos;t see your destination? Type any city into the planner. Giro plans anywhere, and Giro AI researches it in depth.</p>
    </div>
  );
}
