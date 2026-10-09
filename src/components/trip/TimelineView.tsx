"use client";

import { Pin } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { clock, dayWindow, fromMinutes, scheduleDay } from "@/lib/schedule";
import type { Trip } from "@/lib/types";
import { CATEGORY_META } from "../meta";

const FROM = 7 * 60;
const TO = 24 * 60;
const PX = 0.8; // pixels per minute

/** Hour-by-hour calendar of the whole trip; tap a stop to pin its start time. */
export function TimelineView({ trip, readOnly, onSetStart }: { trip: Trip; readOnly: boolean; onSetStart: (dayIndex: number, activityId: string, hhmm: string | undefined) => void }) {
  const [editing, setEditing] = useState<string>();
  const hours = Array.from({ length: (TO - FROM) / 60 + 1 }, (_, i) => FROM + i * 60);
  const height = (TO - FROM) * PX;

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <div className="flex min-w-max">
        <div className="sticky left-0 z-10 w-16 shrink-0 border-r border-line bg-surface">
          <div className="h-14 border-b border-line" />
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted" style={{ top: (h - FROM) * PX }}>{clock(h).replace(":00", "")}</span>
            ))}
          </div>
        </div>
        {trip.days.map((day) => {
          const w = dayWindow(trip, day);
          const items = scheduleDay(trip, day, w);
          return (
            <div key={day.index} className="w-56 shrink-0 border-r border-line last:border-r-0">
              <div className="h-14 border-b border-line px-3 py-2">
                <p className="text-xs font-semibold text-muted">Day {day.index + 1} · {formatDate(day.date, { weekday: "short", month: "short", day: "numeric" })}</p>
                <p className="truncate text-sm font-semibold">{day.theme}</p>
              </div>
              <div className="relative" style={{ height }}>
                {hours.map((h) => <span key={h} className="absolute inset-x-0 border-t border-line/60" style={{ top: (h - FROM) * PX }} />)}
                {/* Shade the hours outside the day's sightseeing window (flights, late arrivals). */}
                {w.start > FROM && <span className="absolute inset-x-0 top-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgb(11_18_32/0.04)_6px,rgb(11_18_32/0.04)_12px)]" style={{ height: Math.min(height, (w.start - FROM) * PX) }} />}
                {w.end < TO && <span className="absolute inset-x-0 bottom-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgb(11_18_32/0.04)_6px,rgb(11_18_32/0.04)_12px)]" style={{ top: Math.max(0, (w.end - FROM) * PX) }} />}
                {items.map((it) => {
                  const top = Math.max(0, (it.start - FROM) * PX);
                  const h = Math.max(18, (Math.min(it.end, TO) - Math.max(it.start, FROM)) * PX - 2);
                  if (it.end <= FROM || it.start >= TO) return null;
                  const tone =
                    it.kind === "flight" ? "border-sky-300 bg-sky-50 text-sky-900" : it.kind === "meal" ? "border-dashed border-line bg-paper text-muted" : it.overflow || it.conflict ? "border-amber-300 bg-amber-50 text-amber-950" : `border-line ${CATEGORY_META[it.activity!.category]?.tone ?? "bg-sand"}`;
                  const key = `${it.kind}-${it.activity?.id ?? it.label}-${it.start}`;
                  const canEdit = it.kind === "activity" && !readOnly;
                  return (
                    <div key={key} className={`absolute inset-x-1.5 overflow-hidden rounded-lg border px-2 py-1 text-[11px] leading-tight shadow-sm ${tone}`} style={{ top, height: h }}>
                      {editing === key && canEdit ? (
                        <span className="flex items-center gap-1">
                          <input
                            type="time"
                            autoFocus
                            defaultValue={fromMinutes(it.start)}
                            aria-label="Start time"
                            className="w-24 rounded border border-line bg-white px-1 text-[11px] text-ink"
                            onBlur={(e) => {
                              if (e.target.value) onSetStart(day.index, it.activity!.id, e.target.value);
                              setEditing(undefined);
                            }}
                          />
                          {it.pinned && <button type="button" className="font-semibold text-brand" onMouseDown={(e) => e.preventDefault()} onClick={() => { onSetStart(day.index, it.activity!.id, undefined); setEditing(undefined); }}>Auto</button>}
                        </span>
                      ) : (
                        <button type="button" disabled={!canEdit} onClick={() => setEditing(key)} className="block w-full text-left" title={canEdit ? "Change start time" : `${clock(it.start)} ${it.label}`}>
                          {h < 34 ? (
                            <span className="block truncate"><span className="font-semibold">{clock(it.start)}</span> {it.label}</span>
                          ) : (
                            <>
                              <span className="flex items-center gap-1 font-semibold">{it.pinned && <Pin className="h-2.5 w-2.5" />}{clock(it.start)}</span>
                              <span className="line-clamp-2 block">{it.label}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
