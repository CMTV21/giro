"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArchiveRestore, GripVertical, Lightbulb, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/dates";
import { ideasFor, type Idea } from "@/lib/ideas";
import { money } from "@/lib/money";
import { loadTaste } from "@/lib/taste-client";
import type { Interest, Trip } from "@/lib/types";
import { CATEGORY_META, INTEREST_META } from "../meta";

export const ideaDragId = (id: string) => `idea::${id}`;

export function IdeasPanel({ trip, readOnly, onAdd, onDismiss }: { trip: Trip; readOnly: boolean; onAdd: (idea: Idea, dayIndex: number) => void; onDismiss: (id: string) => void }) {
  const cities = [...new Set(trip.days.map((d) => d.city))];
  const [city, setCity] = useState(cities[0]);
  const [filter, setFilter] = useState<Interest | "all">("all");
  const ideas = useMemo(() => ideasFor(trip, city ?? cities[0], loadTaste()), [trip, city, cities]);
  const shown = ideas.filter((i) => filter === "all" || i.categories.includes(filter)).slice(0, 30);
  const cats = [...new Set(ideas.flatMap((i) => i.categories))].slice(0, 8) as Interest[];
  const days = trip.days.filter((d) => d.city === city);

  return (
    <section aria-labelledby="ideas-title" className="rounded-2xl border border-line bg-surface p-4">
      <h3 id="ideas-title" className="flex items-center gap-2 font-semibold"><Lightbulb className="h-4 w-4 text-brand" /> Ideas</h3>
      <p className="mt-0.5 text-xs text-muted">{readOnly ? "More to see in the area." : "Drag into any day, or use “Add to”. Stops you remove land here too."}</p>
      {cities.length > 1 && (
        <div role="tablist" className="mt-3 flex flex-wrap gap-1">
          {cities.map((c) => (
            <button key={c} role="tab" aria-selected={c === city} onClick={() => setCity(c)} className={`rounded-full px-3 py-1 text-xs font-semibold ${c === city ? "bg-ink text-white" : "bg-sand text-ink-soft hover:text-ink"}`}>
              {c}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1">
        <button type="button" className="chip px-2.5 py-1 text-xs" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
        {cats.map((c) => (
          <button key={c} type="button" className="chip px-2.5 py-1 text-xs" aria-pressed={filter === c} onClick={() => setFilter(c)}>{INTEREST_META[c].label}</button>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {shown.map((idea) => <IdeaCard key={idea.id} idea={idea} trip={trip} days={days} readOnly={readOnly} onAdd={onAdd} onDismiss={onDismiss} />)}
        {!shown.length && <li className="py-4 text-center text-sm text-muted">No ideas left for this filter.</li>}
      </ul>
    </section>
  );
}

function IdeaCard({ idea, trip, days, readOnly, onAdd, onDismiss }: { idea: Idea; trip: Trip; days: Trip["days"]; readOnly: boolean; onAdd: (idea: Idea, dayIndex: number) => void; onDismiss: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: ideaDragId(idea.id), data: { type: "idea", idea }, disabled: readOnly });
  const meta = CATEGORY_META[idea.category] ?? CATEGORY_META.free;
  const Icon = meta.icon;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }} className="rounded-xl border border-line bg-paper/60 p-3">
      <div className="flex items-start gap-2">
        {!readOnly && (
          <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" aria-label={`Drag ${idea.title} into a day`} className="mt-0.5 grid h-7 w-6 shrink-0 cursor-grab touch-none place-items-center rounded text-muted hover:bg-sand active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${meta.tone}`}><Icon className="h-3.5 w-3.5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-semibold">{idea.title}</p>
          <p className="mt-0.5 text-xs text-muted">{[idea.area, `${idea.durationHrs}h`, idea.estCost ? money(trip, idea.estCost, true) : "Free"].filter(Boolean).join(" · ")}</p>
          {idea.origin === "parked" && idea.reason && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900"><ArchiveRestore className="h-3 w-3" /> {idea.reason}</p>
          )}
        </div>
        {idea.origin === "parked" && !readOnly && (
          <button type="button" aria-label={`Discard ${idea.title}`} title="Discard" onClick={() => onDismiss(idea.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"><X className="h-3.5 w-3.5" /></button>
        )}
      </div>
      {!readOnly && days.length > 0 && (
        <label className="mt-2 flex items-center gap-2 text-xs">
          <Plus className="h-3.5 w-3.5 text-muted" />
          <select
            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs"
            value=""
            aria-label={`Add ${idea.title} to a day`}
            onChange={(e) => e.target.value !== "" && onAdd(idea, Number(e.target.value))}
          >
            <option value="">Add to…</option>
            {days.map((d) => <option key={d.index} value={d.index}>Day {d.index + 1} · {formatDate(d.date, { weekday: "short", month: "short", day: "numeric" })}</option>)}
          </select>
        </label>
      )}
    </li>
  );
}
