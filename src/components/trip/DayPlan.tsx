"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BedDouble, Navigation, Plane, Plus, Printer, Shuffle, UtensilsCrossed, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { accessCaution, effortOf } from "@/lib/access";
import { mapsRouteUrl } from "@/lib/booking";
import { newId, suggestAlternatives } from "@/lib/curate";
import { formatDate } from "@/lib/dates";
import { money, tripFx } from "@/lib/money";
import { clock, dayWindow, scheduleDay, toMinutes, type ScheduledItem } from "@/lib/schedule";
import type { VoteTally } from "@/lib/storage";
import { loadTaste, recordSignal, setBlocked } from "@/lib/taste-client";
import type { Activity, Day, Slot, Trip } from "@/lib/types";
import { applyStopEdit, customStop, draftFrom, emptyDraft, placeBySlot } from "@/lib/plan-edit";
import { ActivityCard, DragHandle } from "./ActivityCard";
import { StopEditor } from "./StopEditor";

export interface DayGroupProps {
  votes?: Record<string, VoteTally>;
  onVote?: (activityId: string, value: -1 | 0 | 1) => void;
  readOnly?: boolean;
  /** Extra content per stop (history & facts). */
  renderExtra?: (a: Activity, city: string) => React.ReactNode;
  /** Optional map for the day. */
  renderMap?: (day: Day, items: ScheduledItem[]) => React.ReactNode;
}

export const dayDropId = (index: number) => `day::${index}`;

export function DayPlan({
  trip,
  day,
  onChange,
  onPark,
  votes,
  onVote,
  readOnly,
  renderExtra,
  renderMap,
}: { trip: Trip; day: Day; onChange: (day: Day) => void; onPark: (a: Activity, reason: string) => void } & DayGroupProps) {
  const [swapping, setSwapping] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string>();
  const fx = tripFx(trip);
  const shared = Boolean(onVote);
  const window = dayWindow(trip, day);
  const items = scheduleDay(trip, day, window);
  const timed = new Map(items.filter((i) => i.activity).map((i) => [i.activity!.id, i]));
  const sortable = items.filter((i) => i.activity).map((i) => i.activity!.id);
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(day.index), data: { type: "day", dayIndex: day.index }, disabled: readOnly });

  const update = (activities: Activity[]) => onChange({ ...day, activities });
  const stops = day.activities.filter((a) => a.category !== "transit" && a.area).map((a) => `${a.category === "free" ? a.area : a.title}, ${day.city}`);
  const route = mapsRouteUrl(stops);
  const stay = trip.stays.find((s) => s.city === day.city && s.checkIn <= day.date && day.date <= s.checkOut);

  return (
    <article id={`day-${day.index + 1}`} className="scroll-mt-32">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Day {day.index + 1} · {formatDate(day.date)}</p>
          <h3 className="mt-1 font-display text-2xl font-semibold sm:text-[1.7rem]">{day.theme}</h3>
          <p className="text-sm text-muted">{day.city}{stay?.booking ? ` · ${stay.booking.name}` : ""}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {route && (
            <a href={route} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3.5 py-2 text-xs">
              <Navigation className="h-3.5 w-3.5" /> Route
            </a>
          )}
          <Link href={`/trip/${trip.id}/guide?day=${day.index + 1}`} className="btn-ghost px-3.5 py-2 text-xs">
            <Printer className="h-3.5 w-3.5" /> Day guide
          </Link>
        </div>
      </header>

      {window.notes.length > 0 && (
        <ul className="mb-4 space-y-1 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
          {window.notes.map((n) => <li key={n} className="flex gap-2"><Plane className="mt-0.5 h-4 w-4 shrink-0" />{n}</li>)}
        </ul>
      )}

      {renderMap?.(day, items)}

      <div ref={setNodeRef} className={`rounded-2xl transition ${isOver ? "bg-brand-soft/60 ring-2 ring-brand/40" : ""}`}>
        <SortableContext id={dayDropId(day.index)} items={sortable} strategy={verticalListSortingStrategy}>
          <ol className="min-h-12">
            {stay?.booking && day.activities.length > 0 && <StayRow name={stay.booking.name} note={day.date === stay.checkIn && stay.booking.checkInTime ? `Check in from ${clock(toMinutes(stay.booking.checkInTime)!)}` : day.date === stay.checkOut && stay.booking.checkOutTime ? `Check out by ${clock(toMinutes(stay.booking.checkOutTime)!)}` : "Start from your stay"} />}
            {items.map((item) => {
              if (item.kind === "meal") return <MealRow key={`${item.label}-${item.start}`} item={item} eat={day.eat} />;
              if (item.kind === "flight") return <FlightRow key={`f-${item.start}-${item.label}`} item={item} />;
              const a = item.activity!;
              return (
                <SortableStop key={a.id} id={a.id} dayIndex={day.index} disabled={readOnly}>
                  {(handle) => (
                    <>
                      <ActivityCard
                        activity={a}
                        city={day.city}
                        fx={fx}
                        tripId={trip.id}
                        time={timed.get(a.id)}
                        caution={accessCaution(effortOf({ key: a.ref ?? "", hrs: a.durationHrs }), trip.request.access)}
                        handle={handle}
                        extra={a.category !== "transit" && a.category !== "free" ? renderExtra?.(a, day.city) : undefined}
                        actions={{
                          onRemove: () => {
                            recordSignal("removed", a.category);
                            onPark(a, "Removed by you");
                          },
                          onToggleBooked: () => {
                            if (!a.booked) recordSignal("booked", a.category);
                            update(day.activities.map((x) => (x.id === a.id ? { ...x, booked: !x.booked } : x)));
                          },
                          onSetStart: (hhmm) => update(day.activities.map((x) => (x.id === a.id ? { ...x, start: hhmm } : x))),
                          onSwap: a.category === "transit" ? undefined : () => setSwapping(swapping === a.id ? undefined : a.id),
                          onEdit: () => setEditing(editing === a.id ? undefined : a.id),
                          onBlock: a.ref && !a.ref.startsWith("food:") && a.category !== "transit"
                            ? () => {
                                setBlocked(a.ref!, true);
                                recordSignal("removed", a.category);
                                update(day.activities.filter((x) => x.id !== a.id));
                              }
                            : undefined,
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
                      {editing === a.id && (
                        <StopEditor
                          mode="edit"
                          initial={draftFrom(a, fx.rate)}
                          fx={fx}
                          shared={shared}
                          onCancel={() => setEditing(undefined)}
                          onSave={(fields) => {
                            const edited = applyStopEdit(a, fields);
                            const without = day.activities.filter((x) => x.id !== a.id);
                            // Same time of day: keep its place. New time of day: move it there.
                            update(edited.slot === a.slot ? day.activities.map((x) => (x.id === a.id ? edited : x)) : placeBySlot(without, edited));
                            setEditing(undefined);
                          }}
                        />
                      )}
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
                    </>
                  )}
                </SortableStop>
              );
            })}
          </ol>
        </SortableContext>
        {!readOnly && day.activities.filter((a) => a.category !== "transit").length === 0 && (
          <p className="mb-4 ml-14 rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Drag ideas here, or add your own stop.</p>
        )}
      </div>

      {day.eat && (
        <p className="mb-4 ml-14 flex gap-2 text-sm text-ink-soft">
          <UtensilsCrossed className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <span><span className="font-semibold text-ink">Eat:</span> {day.eat}</span>
        </p>
      )}

      {!readOnly && (
        <div className="no-print ml-14">
          {adding ? (
            <div className="-ml-14">
              <StopEditor
                mode="add"
                initial={emptyDraft()}
                fx={fx}
                shared={shared}
                onCancel={() => setAdding(false)}
                onSave={(fields) => {
                  const a = customStop(fields, newId());
                  recordSignal("added", a.category);
                  update(placeBySlot(day.activities, a));
                  setAdding(false);
                }}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand hover:text-ink">
              <Plus className="h-4 w-4" /> Add your own stop
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function SortableStop({ id, dayIndex, disabled, children }: { id: string; dayIndex: number; disabled?: boolean; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, data: { type: "activity", dayIndex }, disabled });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} className="relative">
      {children(disabled ? null : <DragHandle ref={setActivatorNodeRef} {...attributes} {...listeners} />)}
    </li>
  );
}

function MealRow({ item, eat }: { item: ScheduledItem; eat?: string }) {
  return (
    <li className="mb-4 ml-[3.25rem] flex items-center gap-3 text-sm text-muted sm:ml-14">
      <UtensilsCrossed className="h-4 w-4 shrink-0 text-brand/70" />
      <span className="font-semibold text-ink-soft">{clock(item.start)}</span>
      <span>{item.label}{item.label === "Dinner" && eat ? ` · ${eat}` : ""}</span>
    </li>
  );
}

function FlightRow({ item }: { item: ScheduledItem }) {
  return (
    <li className="mb-4 flex gap-3 sm:gap-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700"><Plane className="h-[18px] w-[18px]" /></span>
      <div className="flex-1 rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-3">
        <p className="text-xs font-semibold tracking-wide text-sky-800 uppercase">{clock(item.start)}{item.end - item.start > 30 && item.end < 24 * 60 - 1 ? ` – ${clock(item.end)}` : ""}</p>
        <p className="font-semibold text-sky-950">{item.label}</p>
      </div>
    </li>
  );
}

function StayRow({ name, note }: { name: string; note: string }) {
  return (
    <li className="mb-4 ml-[3.25rem] flex items-center gap-3 text-sm text-muted sm:ml-14">
      <BedDouble className="h-4 w-4 shrink-0 text-sea" />
      <span><span className="font-semibold text-ink-soft">{name}</span> · {note}</span>
    </li>
  );
}

function SwapPanel({ trip, day, slot, onPick, onClose }: { trip: Trip; day: Day; slot: Slot; onPick: (a: Activity) => void; onClose: () => void }) {
  const alternatives = suggestAlternatives(trip, day.index, slot, 4, loadTaste());
  return (
    <div className="mb-5 ml-14 rounded-2xl border border-ink/10 bg-sand/60 p-4">
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
        <p className="text-sm text-muted">You&apos;ve already got our best picks for this slot. Browse Ideas or add your own stop.</p>
      )}
    </div>
  );
}
