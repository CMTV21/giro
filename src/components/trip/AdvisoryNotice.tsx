"use client";

import { ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { ADVISORY_SOURCE, LEVELS, nextSeen, raisedSince, type Advisory } from "@/lib/advisories";
import { formatDate } from "@/lib/dates";
import type { Trip } from "@/lib/types";

type Row = Advisory & { cities: string[] };

export function AdvisoryRows({ advisories, raised = [] }: { advisories: Row[] | Advisory[]; raised?: string[] }) {
  return (
    <ul className="space-y-2">
      {advisories.map((a) => {
        const level = LEVELS[a.level];
        const up = raised.includes(a.iso);
        return (
          <li key={a.iso} className={`rounded-xl border px-3.5 py-2.5 text-sm ${level.tone}`}>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {a.level === 0 ? <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> : <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />}
              <span className="font-semibold">{a.country}: {level.label}</span>
              {up && <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold">Raised since you last looked</span>}
            </p>
            <p className="mt-0.5 pl-6 text-xs opacity-90">
              {a.regional && "Some regions have stricter advice. "}
              {a.updated && `Updated ${formatDate(a.updated, { month: "short", day: "numeric", year: "numeric" })}. `}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold underline-offset-2 hover:underline">Read the official advice <ExternalLink className="h-3 w-3" /></a>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** Official travel advice for every country on the trip, flagging any that got stricter. */
export function AdvisoryNotice({ trip, readOnly, onSeen }: { trip: Trip; readOnly: boolean; onSeen: (seen: Record<string, number>) => void }) {
  const [rows, setRows] = useState<Row[]>();
  const cities = [...new Set(trip.days.map((d) => d.city))];
  const key = cities.join("|");

  useEffect(() => {
    let live = true;
    fetch(`/api/advisories?cities=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : { advisories: [] }))
      .then((j: { advisories?: Row[] }) => live && setRows(j.advisories ?? []))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [key]);

  const raised = rows ? raisedSince(trip.advisorySeen, rows).map((a) => a.iso) : [];
  // Remember what was shown, after it's on screen, so the "raised" badge appears once per change.
  useEffect(() => {
    if (!rows?.length || readOnly) return;
    const next = nextSeen(trip.advisorySeen, rows);
    if (next) {
      const t = setTimeout(() => onSeen(next), 1500);
      return () => clearTimeout(t);
    }
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows?.length) return null;
  const serious = rows.some((a) => a.level >= 2) || raised.length > 0;
  return (
    <section aria-labelledby="advisory-title" className={serious ? "card p-5 sm:p-6" : "rounded-2xl border border-line bg-surface p-4"}>
      <h3 id="advisory-title" className="mb-3 text-sm font-semibold">Official travel advice for Canadians</h3>
      <AdvisoryRows advisories={rows} raised={raised} />
      <p className="mt-2 text-xs text-muted">From the {ADVISORY_SOURCE} (travel.gc.ca). Check again before you leave; Giro shows the latest each time you open the trip.</p>
    </section>
  );
}
