"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CalendarClock, LayoutList } from "lucide-react";
import { useEffect, useState } from "react";
import { recalcBudget } from "@/lib/curate";
import { formatDate } from "@/lib/dates";
import type { Idea } from "@/lib/ideas";
import { dismissIdea, insertIdea, moveStop, parkActivity, setStart } from "@/lib/plan-edit";
import type { VoteTally } from "@/lib/storage";
import { recordSignal } from "@/lib/taste-client";
import type { Day, Trip } from "@/lib/types";
import { DayPlan, type DayGroupProps } from "./DayPlan";
import { IdeasPanel } from "./IdeasPanel";
import { TimelineView } from "./TimelineView";

type View = "list" | "timeline";
const VIEW_KEY = "giro.itineraryView";

// Prefer whatever is under the pointer (empty days, cards); fall back to the nearest card.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCenter(args);
};

export function ItineraryBoard({
  trip,
  readOnly,
  votes,
  onVote,
  onChange,
  onMessage,
  renderExtra,
  renderMap,
}: {
  trip: Trip;
  readOnly: boolean;
  votes?: Record<string, VoteTally>;
  onVote?: (activityId: string, value: -1 | 0 | 1) => void;
  onChange: (t: Trip) => void;
  onMessage: (m: string) => void;
} & Pick<DayGroupProps, "renderExtra" | "renderMap">) {
  const [view, setView] = useState<View>("list");
  const [dragging, setDragging] = useState<string>();

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "list" || v === "timeline") setView(v);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const choose = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage unavailable */
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const commit = (next: Trip) => onChange(recalcBudget(next));
  const dayOf = (activityId: string) => trip.days.find((d) => d.activities.some((a) => a.id === activityId));

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current as { type: string; idea?: Idea } | undefined;
    setDragging(data?.type === "idea" ? data.idea!.title : trip.days.flatMap((d) => d.activities).find((a) => a.id === e.active.id)?.title);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(undefined);
    const { active, over } = e;
    if (!over) return;
    const overData = over.data.current as { type?: string; dayIndex?: number } | undefined;
    const toDay = overData?.dayIndex ?? dayOf(String(over.id))?.index;
    if (toDay === undefined) return;
    const beforeId = overData?.type === "day" ? undefined : String(over.id);
    const data = active.data.current as { type: string; idea?: Idea; dayIndex?: number } | undefined;

    const result =
      data?.type === "idea"
        ? insertIdea(trip, data.idea!, toDay, beforeId)
        : data?.type === "activity" && data.dayIndex !== undefined
          ? moveStop(trip, data.dayIndex, String(active.id), toDay, beforeId)
          : undefined;
    if (!result) return;
    if (result.error) return onMessage(result.error);
    if (data?.type === "idea") recordSignal("added", data.idea!.category);
    if (result.trip !== trip) commit(result.trip);
  }

  const groupProps = { votes, onVote, readOnly, renderExtra, renderMap };

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(undefined)}>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Jump to day" className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
          {trip.days.map((d) => (
            <a key={d.index} href={`#day-${d.index + 1}`} onClick={() => view === "timeline" && choose("list")} className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-ink/30 hover:text-ink">
              Day {d.index + 1} <span className="font-normal text-muted">· {formatDate(d.date, { month: "short", day: "numeric" })}</span>
            </a>
          ))}
        </nav>
        <div role="tablist" aria-label="Itinerary view" className="inline-flex rounded-full border border-line bg-surface p-1">
          <button role="tab" aria-selected={view === "list"} onClick={() => choose("list")} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${view === "list" ? "bg-ink text-white" : "text-ink-soft"}`}><LayoutList className="h-3.5 w-3.5" /> List</button>
          <button role="tab" aria-selected={view === "timeline"} onClick={() => choose("timeline")} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${view === "timeline" ? "bg-ink text-white" : "text-ink-soft"}`}><CalendarClock className="h-3.5 w-3.5" /> Timeline</button>
        </div>
      </div>

      {view === "timeline" ? (
        <TimelineView trip={trip} readOnly={readOnly} onSetStart={(di, id, hhmm) => commit(setStart(trip, di, id, hhmm))} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-12">
            {trip.days.map((d) => (
              <DayPlan
                key={d.index}
                trip={trip}
                day={d}
                onChange={(day: Day) => commit({ ...trip, days: trip.days.map((x) => (x.index === day.index ? day : x)) })}
                onPark={(a, reason) => commit(parkActivity(trip, d.index, a.id, reason))}
                {...groupProps}
              />
            ))}
          </div>
          <aside className="no-print lg:sticky lg:top-36 lg:max-h-[calc(100vh-10rem)] lg:self-start lg:overflow-y-auto">
            <IdeasPanel
              trip={trip}
              readOnly={readOnly}
              onAdd={(idea, dayIndex) => {
                const r = insertIdea(trip, idea, dayIndex);
                if (r.error) return onMessage(r.error);
                recordSignal("added", idea.category);
                commit(r.trip);
                onMessage(`Added ${idea.title} to day ${dayIndex + 1}.`);
              }}
              onDismiss={(id) => commit(dismissIdea(trip, id))}
            />
          </aside>
        </div>
      )}

      <DragOverlay dropAnimation={null}>
        {dragging && <div className="rounded-xl border border-ink/20 bg-surface px-4 py-2 text-sm font-semibold shadow-lift">{dragging}</div>}
      </DragOverlay>
    </DndContext>
  );
}
