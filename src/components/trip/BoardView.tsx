"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ArchiveRestore, Ban, CircleCheck, Lightbulb, MapPin, Pencil, Pin, Plus, Star, Ticket, X } from "lucide-react";
import { useState } from "react";
import { BOARD_FROM, BOARD_TO, lengthLabel, placeAtTime, setDuration, slotForTime, snap, type BoardSource } from "@/lib/board";
import { experienceLinks, mapsSearchUrl, reviewsLink, trackedHref } from "@/lib/booking";
import { newId } from "@/lib/curate";
import { formatDate } from "@/lib/dates";
import { ideasFor, type Idea } from "@/lib/ideas";
import { money, tripFx } from "@/lib/money";
import { applyStopEdit, customStop, draftFrom, emptyDraft, MAX_STOP_HOURS, parkActivity, setStart } from "@/lib/plan-edit";
import type { StopHours } from "@/lib/hours-client";
import { clock, dayWindow, fromMinutes, scheduleDay, toMinutes, travelLabel, travelMinutes, type ScheduledItem } from "@/lib/schedule";
import { loadTaste, recordSignal, setBlocked } from "@/lib/taste-client";
import type { Activity, Day, Trip } from "@/lib/types";
import { CATEGORY_META } from "../meta";
import { IdeasPanel } from "./IdeasPanel";
import { StopEditor } from "./StopEditor";

/** Pixels per minute: an hour is 60px tall. */
export const BOARD_PX = 1;
const HEIGHT = (BOARD_TO - BOARD_FROM) * BOARD_PX;
const HOURS = Array.from({ length: (BOARD_TO - BOARD_FROM) / 60 + 1 }, (_, i) => BOARD_FROM + i * 60);
const HATCH = "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgb(11_18_32/0.04)_6px,rgb(11_18_32/0.04)_12px)]";

export const boardDayId = (index: number) => `board-day::${index}`;
export const boardStopId = (id: string) => `board-stop::${id}`;

/** Where a drag would land, shown as a ghost on the board. */
export interface BoardPreview {
  dayIndex: number;
  minutes: number;
  lengthMins: number;
  /** Set when the drop isn't allowed (another city). */
  blocked?: string;
}

type HoursOf = (a: Activity, day: Day, item?: Pick<ScheduledItem, "start" | "end">) => StopHours | undefined;

type Selection = { kind: "stop"; activityId: string; editing?: boolean } | { kind: "add"; dayIndex: number; minutes: number };

/**
 * The multi-day board: every day side by side on one clock. Drag stops between days and times,
 * stretch them to change how long they take, tap one to edit or book it, tap an empty spot to add.
 */
export function BoardView({ trip, readOnly, preview, onChange, onMessage, hoursOf }: { trip: Trip; readOnly: boolean; preview?: BoardPreview; onChange: (t: Trip) => void; onMessage: (m: string) => void; hoursOf?: HoursOf }) {
  const [selected, setSelected] = useState<Selection>();
  const place = (source: BoardSource, dayIndex: number, minutes: number) => {
    const r = placeAtTime(trip, source, dayIndex, minutes);
    if (r.error) return onMessage(r.error);
    onChange(r.trip);
    return r.trip;
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        {!readOnly && <p className="mb-2 text-xs text-muted">Drag stops to any day or time, stretch the bottom edge to change how long, or tap an empty spot to add something.</p>}
        <div className="max-h-[calc(100vh-11rem)] min-h-[28rem] scroll-mt-32 overflow-auto rounded-2xl border border-line bg-surface">
          <div className="flex min-w-max">
            <div className="sticky left-0 z-20 w-14 shrink-0 border-r border-line bg-surface">
              <div className="sticky top-0 z-30 h-16 border-b border-line bg-surface" />
              <div className="relative" style={{ height: HEIGHT }}>
                {HOURS.map((h) => (
                  <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted" style={{ top: (h - BOARD_FROM) * BOARD_PX }}>{h < BOARD_TO ? clock(h).replace(":00", "") : ""}</span>
                ))}
              </div>
            </div>
            {trip.days.map((day) => (
              <DayColumn
                key={day.index}
                trip={trip}
                day={day}
                readOnly={readOnly}
                preview={preview?.dayIndex === day.index ? preview : undefined}
                selectedId={selected?.kind === "stop" ? selected.activityId : undefined}
                onSelect={(activityId) => setSelected({ kind: "stop", activityId })}
                onAddAt={(minutes) => setSelected({ kind: "add", dayIndex: day.index, minutes })}
                onResize={(activityId, mins) => onChange(setDuration(trip, day.index, activityId, mins))}
                hoursOf={hoursOf}
              />
            ))}
          </div>
        </div>
      </div>

      <aside className="no-print lg:sticky lg:top-36 lg:max-h-[calc(100vh-10rem)] lg:self-start lg:overflow-y-auto">
        {selected && !readOnly ? (
          <div className="fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto rounded-t-3xl border border-line bg-surface p-4 shadow-lift lg:static lg:max-h-none lg:rounded-2xl lg:shadow-none">
            {selected.kind === "stop" ? (
              <StopPanel trip={trip} selection={selected} onClose={() => setSelected(undefined)} onEditing={(editing) => setSelected({ ...selected, editing })} onChange={onChange} onPlace={(source, d, m) => place(source, d, m)} hoursOf={hoursOf} />
            ) : (
              <AddPanel trip={trip} dayIndex={selected.dayIndex} minutes={selected.minutes} onClose={() => setSelected(undefined)} onPlace={(source) => place(source, selected.dayIndex, selected.minutes) && setSelected(undefined)} onPlaceAt={(source, m) => place(source, selected.dayIndex, m) && setSelected(undefined)} />
            )}
          </div>
        ) : (
          <IdeasPanel
            trip={trip}
            readOnly={readOnly}
            onAdd={(idea, dayIndex) => {
              const r = placeAtTime(trip, { kind: "idea", idea }, dayIndex, nextFreeTime(trip, trip.days[dayIndex], idea.durationHrs * 60));
              if (r.error) return onMessage(r.error);
              recordSignal("added", idea.category);
              onChange(r.trip);
              onMessage(`Added ${idea.title} to day ${dayIndex + 1}.`);
            }}
            onDismiss={(id) => onChange({ ...trip, parked: (trip.parked ?? []).filter((p) => p.id !== id) })}
          />
        )}
      </aside>
    </div>
  );
}

/** The first gap in a day long enough for a stop, for "Add to…" from the Ideas list. */
function nextFreeTime(trip: Trip, day: Day, lengthMins: number): number {
  const w = dayWindow(trip, day);
  const busy = scheduleDay(trip, day, w).filter((i) => i.kind !== "meal").sort((a, b) => a.start - b.start);
  let t = Math.max(w.start, BOARD_FROM);
  for (const b of busy) {
    if (b.start - t >= lengthMins + 20) break;
    t = Math.max(t, b.end + 20);
  }
  return snap(Math.min(t, BOARD_TO - lengthMins));
}

function DayColumn({ trip, day, readOnly, preview, selectedId, onSelect, onAddAt, onResize, hoursOf }: { trip: Trip; day: Day; readOnly: boolean; preview?: BoardPreview; selectedId?: string; onSelect: (id: string) => void; onAddAt: (minutes: number) => void; onResize: (id: string, minutes: number) => void; hoursOf?: HoursOf }) {
  const { setNodeRef, isOver } = useDroppable({ id: boardDayId(day.index), data: { type: "board-day", dayIndex: day.index }, disabled: readOnly });
  const w = dayWindow(trip, day);
  const items = scheduleDay(trip, day, w);
  const acts = items.filter((i) => i.kind === "activity");

  return (
    <div className="w-48 shrink-0 border-r border-line last:border-r-0 sm:w-56">
      <div className="sticky top-0 z-10 h-16 border-b border-line bg-surface px-3 py-2">
        <p className="text-xs font-semibold text-muted">Day {day.index + 1} · {formatDate(day.date, { weekday: "short", month: "short", day: "numeric" })}</p>
        <p className="truncate text-sm font-semibold" title={day.theme}>{day.theme}</p>
        <p className="truncate text-[11px] text-muted">{day.city}</p>
      </div>
      <div
        ref={setNodeRef}
        data-day={day.index}
        className={`relative ${isOver ? "bg-brand-soft/30" : ""} ${readOnly ? "" : "cursor-copy"}`}
        style={{ height: HEIGHT }}
        onClick={(e) => {
          if (readOnly || e.target !== e.currentTarget) return;
          const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
          onAddAt(snap(BOARD_FROM + y / BOARD_PX - 30, 30));
        }}
      >
        {HOURS.map((h) => <span key={h} className="pointer-events-none absolute inset-x-0 border-t border-line/60" style={{ top: (h - BOARD_FROM) * BOARD_PX }} />)}
        {w.start > BOARD_FROM && <span className={`pointer-events-none absolute inset-x-0 top-0 ${HATCH}`} style={{ height: Math.min(HEIGHT, (w.start - BOARD_FROM) * BOARD_PX) }} />}
        {w.end < BOARD_TO && <span className={`pointer-events-none absolute inset-x-0 bottom-0 ${HATCH}`} style={{ top: Math.max(0, (w.end - BOARD_FROM) * BOARD_PX) }} />}

        {/* Travel between consecutive stops. */}
        {acts.slice(1).map((it, k) => {
          const prev = acts[k];
          const mins = travelMinutes(prev.activity, it.activity);
          if (!mins || it.start - prev.end < mins || it.start <= BOARD_FROM) return null;
          // Don't draw over a meal or flight in the same window.
          if (items.some((x) => x.kind !== "activity" && x.start < it.start && x.end > it.start - mins)) return null;
          return (
            <span key={`t-${it.activity!.id}`} className="pointer-events-none absolute left-3 flex items-center gap-1 border-l-2 border-dotted border-ink/25 pl-1.5 text-[10px] text-muted" style={{ top: (it.start - mins - BOARD_FROM) * BOARD_PX, height: mins * BOARD_PX }}>
              {mins * BOARD_PX >= 14 && (travelLabel(prev.activity, it.activity)?.replace(" by taxi or transit", " ride") ?? `~${mins} min`)}
            </span>
          );
        })}

        {items.map((it) => (it.end <= BOARD_FROM || it.start >= BOARD_TO ? null : it.kind === "activity" ? (
          <StopBlock key={it.activity!.id} trip={trip} day={day} item={it} readOnly={readOnly} selected={selectedId === it.activity!.id} onSelect={() => onSelect(it.activity!.id)} onResize={(m) => onResize(it.activity!.id, m)} hoursIssue={hoursOf?.(it.activity!, day, it)?.issue} />
        ) : (
          <div key={`${it.kind}-${it.label}-${it.start}`} className={`pointer-events-none absolute inset-x-1.5 overflow-hidden rounded-lg border px-2 py-1 text-[11px] leading-tight ${it.kind === "flight" ? "border-sky-300 bg-sky-50 text-sky-900" : "border-dashed border-line bg-paper/80 text-muted"}`} style={blockBox(it.start, it.end)}>
            <span className="font-semibold">{clock(it.start)}</span> {it.label}
          </div>
        )))}

        {preview && (
          <div className={`pointer-events-none absolute inset-x-1 z-20 rounded-lg border-2 border-dashed px-2 py-1 text-[11px] font-semibold ${preview.blocked ? "border-amber-400 bg-amber-50/80 text-amber-900" : "border-brand bg-brand-soft/60 text-brand-dark"}`} style={blockBox(preview.minutes, preview.minutes + preview.lengthMins)}>
            {preview.blocked ?? `${clock(preview.minutes)} – ${clock(preview.minutes + preview.lengthMins)}`}
          </div>
        )}
      </div>
    </div>
  );
}

const blockBox = (start: number, end: number) => ({
  top: Math.max(0, (start - BOARD_FROM) * BOARD_PX),
  height: Math.max(20, (Math.min(end, BOARD_TO) - Math.max(start, BOARD_FROM)) * BOARD_PX - 2),
});

function StopBlock({ trip, day, item, readOnly, selected, onSelect, onResize, hoursIssue }: { trip: Trip; day: Day; item: ScheduledItem; readOnly: boolean; selected: boolean; onSelect: () => void; onResize: (minutes: number) => void; hoursIssue?: string }) {
  const a = item.activity!;
  const movable = !readOnly && a.category !== "transit";
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: boardStopId(a.id), data: { type: "board-stop", dayIndex: day.index, activityId: a.id, lengthMins: Math.round(a.durationHrs * 60), title: a.title }, disabled: !movable });
  // Pointer and touch drags only: on the keyboard, Enter opens the stop, whose panel moves and re-times it.
  const { onKeyDown: _keyboardDrag, ...dragListeners } = listeners ?? {};
  const [stretch, setStretch] = useState<number>();
  const length = stretch ?? item.end - item.start;
  const box = blockBox(item.start, item.start + length);
  const tone = item.overflow || item.conflict || hoursIssue ? "border-amber-300 bg-amber-50 text-amber-950" : `border-line ${CATEGORY_META[a.category]?.tone ?? "bg-sand"}`;
  const cost = a.category !== "transit" && a.category !== "free" ? (a.estCost ? money(trip, a.estCost, true) : "Free") : undefined;
  const tall = box.height >= 52;

  return (
    <div
      ref={setNodeRef}
      {...dragListeners}
      className={`group absolute inset-x-1.5 overflow-hidden rounded-lg border text-[11px] leading-tight shadow-sm transition-shadow ${tone} ${selected ? "ring-2 ring-ink" : ""} ${isDragging ? "opacity-40" : ""} ${movable ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ ...box, zIndex: stretch !== undefined || selected ? 15 : undefined }}
      title={item.conflict ?? hoursIssue ?? (item.overflow ? "Runs outside the day's free time" : undefined)}
    >
      <button type="button" onClick={onSelect} disabled={readOnly} className="block h-full w-full px-2 py-1 text-left" aria-label={`${a.title}, ${clock(item.start)} to ${clock(item.start + length)}${movable ? ". Drag to move, or open to edit" : ""}`}>
        <span className="flex items-center gap-1 font-semibold">
          {item.pinned && <Pin className="h-2.5 w-2.5 shrink-0" aria-label="Pinned time" />}
          <span className="truncate">{clock(item.start)}{tall ? ` – ${clock(item.start + length)}` : ""}</span>
          {a.booked && <CircleCheck className="ml-auto h-3 w-3 shrink-0 text-sea" aria-label="Booked" />}
        </span>
        <span className={`block ${tall ? "line-clamp-2" : "truncate"}`}>{a.title}</span>
        {tall && cost && <span className="mt-0.5 block truncate opacity-75">{cost}{a.bookable && !a.booked ? " · Book" : ""}</span>}
        {stretch !== undefined && <span className="mt-0.5 block font-semibold">{lengthLabel(stretch)}</span>}
      </button>
      {movable && (
        <span
          role="separator"
          aria-label={`Drag to change how long ${a.title} takes`}
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none opacity-0 transition group-hover:opacity-100 after:absolute after:inset-x-1/3 after:bottom-0.5 after:h-0.5 after:rounded after:bg-ink/40"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const startY = e.clientY;
            const base = item.end - item.start;
            const el = e.currentTarget;
            el.setPointerCapture(e.pointerId);
            const move = (ev: PointerEvent) => setStretch(Math.max(15, Math.min(MAX_STOP_HOURS * 60, snap(base + (ev.clientY - startY) / BOARD_PX))));
            const up = (ev: PointerEvent) => {
              el.removeEventListener("pointermove", move);
              el.removeEventListener("pointerup", up);
              el.removeEventListener("pointercancel", up);
              const mins = Math.max(15, Math.min(MAX_STOP_HOURS * 60, snap(base + (ev.clientY - startY) / BOARD_PX)));
              setStretch(undefined);
              if (ev.type === "pointerup" && mins !== base) onResize(mins);
            };
            el.addEventListener("pointermove", move);
            el.addEventListener("pointerup", up);
            el.addEventListener("pointercancel", up);
          }}
        />
      )}
    </div>
  );
}

function PanelHeader({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="font-semibold leading-snug">{title}</h3>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"><X className="h-4 w-4" /></button>
    </div>
  );
}

function StopPanel({ trip, selection, onClose, onEditing, onChange, onPlace, hoursOf }: { trip: Trip; selection: Extract<Selection, { kind: "stop" }>; onClose: () => void; onEditing: (on: boolean) => void; onChange: (t: Trip) => void; onPlace: (source: BoardSource, dayIndex: number, minutes: number) => Trip | void; hoursOf?: HoursOf }) {
  // Found by id, so the panel follows a stop dragged to another day.
  const day = trip.days.find((d) => d.activities.some((x) => x.id === selection.activityId));
  const a = day?.activities.find((x) => x.id === selection.activityId);
  if (!day || !a) return <PanelHeader title="This stop has moved" onClose={onClose} />;
  const fx = tripFx(trip);
  const item = scheduleDay(trip, day).find((i) => i.activity?.id === a.id);
  const hours = item ? hoursOf?.(a, day, item) : undefined;
  const start = item?.start ?? BOARD_FROM;
  const lengthMins = Math.round(a.durationHrs * 60);
  const isTransit = a.category === "transit";
  const isFree = a.category === "free";
  const meta = CATEGORY_META[a.category] ?? CATEGORY_META.free;
  const ticket = a.bookable ? experienceLinks(day.city, a.title, fx.currency)[0] : undefined;
  const sameCity = trip.days.filter((d) => d.city === day.city);
  const update = (fn: (x: Activity) => Activity) => onChange({ ...trip, days: trip.days.map((d) => (d.index === day.index ? { ...d, activities: d.activities.map((x) => (x.id === a.id ? fn(x) : x)) } : d)) });

  if (selection.editing) {
    return (
      <>
        <PanelHeader title="Edit stop" sub={`Day ${day.index + 1} · ${day.city}`} onClose={() => onEditing(false)} />
        <StopEditor
          compact
          initial={draftFrom(a, fx.rate)}
          fx={fx}
          mode="edit"
          onCancel={() => onEditing(false)}
          onSave={(fields) => {
            update((x) => applyStopEdit(x, fields));
            onEditing(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <PanelHeader title={a.title} sub={[meta.label, a.area].filter(Boolean).join(" · ")} onClose={onClose} />
      {a.description && <p className="mb-3 text-sm text-ink-soft">{a.description}</p>}
      {item?.conflict && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{item.conflict}</p>}
      {hours?.issue && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{hours.issue}</p>}
      {hours && <p className="mb-3 text-xs text-muted">Open {formatDate(day.date, { weekday: "long" })}: <span className="font-semibold text-ink-soft">{hours.label}</span> (Google)</p>}

      {!isTransit && (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-muted">
            Day
            <select className="field mt-1 py-2" value={day.index} onChange={(e) => onPlace({ kind: "stop", dayIndex: day.index, activityId: a.id }, Number(e.target.value), start)}>
              {sameCity.map((d) => <option key={d.index} value={d.index}>Day {d.index + 1} · {formatDate(d.date, { weekday: "short", month: "short", day: "numeric" })}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Starts
            <input
              type="time"
              step={900}
              className="field mt-1 py-2"
              key={`${a.id}-${start}`}
              defaultValue={fromMinutes(start)}
              onBlur={(e) => {
                const m = toMinutes(e.target.value);
                if (m !== undefined && m !== start) onPlace({ kind: "stop", dayIndex: day.index, activityId: a.id }, day.index, m);
              }}
            />
          </label>
          <label className="col-span-2 text-xs font-medium text-muted">
            How long
            <select className="field mt-1 py-2" value={lengthMins} onChange={(e) => onChange(setDuration(trip, day.index, a.id, Number(e.target.value)))}>
              {lengthOptions(lengthMins).map((m) => <option key={m} value={m}>{lengthLabel(m)}</option>)}
            </select>
          </label>
        </div>
      )}
      {a.start && !isTransit && (
        <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand" onClick={() => onChange(setStart(trip, day.index, a.id, undefined))}>
          <Pin className="h-3 w-3" /> Pinned at {clock(toMinutes(a.start)!)} · Let Giro time it
        </button>
      )}

      {!isTransit && !isFree && (
        <p className="mt-3 text-sm"><span className="text-muted">Cost per adult:</span> <span className="font-semibold">{a.estCost ? money(trip, a.estCost, true) : "Free"}</span></p>
      )}
      {a.note && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950">{a.note}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {ticket && !a.booked && (
          <a href={trackedHref({ ...ticket, valueUSD: a.estCost }, trip.id)} target="_blank" rel="noopener noreferrer sponsored" className="btn-primary px-3.5 py-2 text-xs"><Ticket className="h-3.5 w-3.5" /> Book tickets</a>
        )}
        {a.bookable && (
          <button type="button" className="btn-ghost px-3.5 py-2 text-xs" onClick={() => {
            if (!a.booked) recordSignal("booked", a.category);
            update((x) => ({ ...x, booked: !x.booked }));
          }}>
            <CircleCheck className={`h-3.5 w-3.5 ${a.booked ? "text-sea" : ""}`} /> {a.booked ? "Booked" : "Mark booked"}
          </button>
        )}
        {!isTransit && !isFree && (
          <a href={trackedHref(reviewsLink(a.title, day.city, fx.currency), trip.id)} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3.5 py-2 text-xs"><Star className="h-3.5 w-3.5" /> Reviews</a>
        )}
        {!isTransit && (
          <a href={mapsSearchUrl(`${isFree ? a.area ?? day.city : a.title}, ${day.city}`)} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3.5 py-2 text-xs"><MapPin className="h-3.5 w-3.5" /> Map</a>
        )}
      </div>

      {!isTransit && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit or add a note</button>
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => {
            recordSignal("removed", a.category);
            onChange(parkActivity(trip, day.index, a.id, "Removed by you"));
            onClose();
          }}><ArchiveRestore className="h-3.5 w-3.5" /> Move to Ideas</button>
          {a.ref && !a.ref.startsWith("food:") && (
            <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => {
              setBlocked(a.ref!, true);
              recordSignal("removed", a.category);
              onChange({ ...trip, days: trip.days.map((d) => (d.index === day.index ? { ...d, activities: d.activities.filter((x) => x.id !== a.id) } : d)) });
              onClose();
            }}><Ban className="h-3.5 w-3.5" /> Never suggest</button>
          )}
        </div>
      )}
    </>
  );
}

/** 15-minute steps up to 3 hours, then half hours to the maximum, always including the current length. */
function lengthOptions(current: number): number[] {
  const opts = new Set<number>();
  for (let m = 15; m <= 180; m += 15) opts.add(m);
  for (let m = 210; m <= MAX_STOP_HOURS * 60; m += 30) opts.add(m);
  opts.add(current);
  return [...opts].sort((x, y) => x - y);
}

function AddPanel({ trip, dayIndex, minutes, onClose, onPlace, onPlaceAt }: { trip: Trip; dayIndex: number; minutes: number; onClose: () => void; onPlace: (source: BoardSource) => void; onPlaceAt: (source: BoardSource, minutes: number) => void }) {
  const day = trip.days[dayIndex];
  const [own, setOwn] = useState(false);
  const fx = tripFx(trip);
  const ideas: Idea[] = day ? ideasFor(trip, day.city, loadTaste()).slice(0, 5) : [];
  if (!day) return null;
  const title = `Add at ${clock(minutes)}`;
  const sub = `Day ${day.index + 1} · ${formatDate(day.date, { weekday: "short", month: "short", day: "numeric" })} · ${day.city}`;

  if (own) {
    return (
      <>
        <PanelHeader title={title} sub={sub} onClose={onClose} />
        <StopEditor
          compact
          mode="add"
          fx={fx}
          initial={{ ...emptyDraft(slotForTime(minutes)), start: fromMinutes(minutes), durationHrs: 1 }}
          onCancel={() => setOwn(false)}
          onSave={(fields) => {
            const at = fields.start ? toMinutes(fields.start) ?? minutes : minutes;
            onPlaceAt({ kind: "new", activity: customStop(fields, newId()) }, at);
          }}
        />
      </>
    );
  }

  return (
    <>
      <PanelHeader title={title} sub={sub} onClose={onClose} />
      <button type="button" className="btn-dark w-full justify-center py-2 text-sm" onClick={() => setOwn(true)}><Plus className="h-4 w-4" /> Your own stop</button>
      {ideas.length > 0 && (
        <>
          <p className="mt-4 mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted"><Lightbulb className="h-3.5 w-3.5 text-brand" /> Or one of these ideas</p>
          <ul className="space-y-1.5">
            {ideas.map((idea) => {
              const meta = CATEGORY_META[idea.category] ?? CATEGORY_META.free;
              const Icon = meta.icon;
              return (
                <li key={idea.id}>
                  <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-line bg-paper/60 p-2.5 text-left hover:border-ink/30" onClick={() => {
                    recordSignal("added", idea.category);
                    onPlace({ kind: "idea", idea });
                  }}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${meta.tone}`}><Icon className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{idea.title}</span>
                      <span className="block text-xs text-muted">{lengthLabel(Math.round(idea.durationHrs * 60))} · {idea.estCost ? money(trip, idea.estCost, true) : "Free"}</span>
                    </span>
                    <Plus className="h-4 w-4 shrink-0 text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
