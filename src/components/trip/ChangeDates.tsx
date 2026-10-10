"use client";

import { CalendarRange, X } from "lucide-react";
import { useState } from "react";
import { addDays, formatRange, nightsBetween } from "@/lib/dates";
import { rescheduleCheck, rescheduleTrip } from "@/lib/reschedule";
import { loadTaste } from "@/lib/taste-client";
import type { Trip } from "@/lib/types";

/** Move the trip or change its length in place, keeping the traveller's edits. */
export function ChangeDates({ trip, onApply, onClose }: { trip: Trip; onApply: (t: Trip, message: string) => void; onClose: () => void }) {
  const [start, setStart] = useState(trip.request.startDate);
  const [end, setEnd] = useState(trip.request.endDate);
  const [error, setError] = useState<string>();
  const problem = rescheduleCheck(trip, start, end);
  const oldDays = trip.days.length;
  const newDays = problem ? oldDays : nightsBetween(start, end) + 1;
  const unchanged = start === trip.request.startDate && end === trip.request.endDate;

  const preview = problem
    ? problem
    : unchanged
      ? "Pick new dates."
      : newDays === oldDays
        ? `Moves your ${oldDays}-day plan to ${formatRange(start, end)}. Every day keeps its stops.`
        : newDays > oldDays
          ? `Adds ${newDays - oldDays} day${newDays - oldDays > 1 ? "s" : ""}. Your plan stays as it is, and new days get fresh picks.`
          : `Removes ${oldDays - newDays} day${oldDays - newDays > 1 ? "s" : ""}. Arrival and departure days stay; stops from removed days move to Ideas.`;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="change-dates-title" className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4" onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <form
        className="card w-full max-w-md p-6 text-ink"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (problem || unchanged) return;
          try {
            const r = rescheduleTrip(trip, start, end, loadTaste());
            const parts = [`Trip now ${formatRange(start, end)}.`];
            if (r.addedDays) parts.push(`${r.addedDays} new day${r.addedDays > 1 ? "s" : ""} added.`);
            if (r.parked.length) parts.push(`${r.parked.length} stop${r.parked.length > 1 ? "s" : ""} moved to Ideas.`);
            onApply(r.trip, [...parts, ...r.warnings].join(" "));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't change the dates.");
          }
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="change-dates-title" className="flex items-center gap-2 text-lg font-semibold"><CalendarRange className="h-5 w-5" /> Change dates</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-sand"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="label">
            Leave
            <input type="date" autoFocus className="field mt-1" value={start} onChange={(e) => {
              const s = e.target.value;
              // Moving the start keeps the length unless the traveller changes the end too.
              setEnd(s && start && end ? addDays(s, nightsBetween(start, end)) : end);
              setStart(s);
            }} />
          </label>
          <label className="label">
            Return
            <input type="date" className="field mt-1" value={end} min={start ? addDays(start, 1) : undefined} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <p className={`mt-3 text-sm ${problem ? "text-brand-dark" : "text-ink-soft"}`}>{preview}</p>
        {error && <p className="mt-2 text-sm font-medium text-brand-dark" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-dark" disabled={Boolean(problem) || unchanged}>Change dates</button>
        </div>
      </form>
    </div>
  );
}
