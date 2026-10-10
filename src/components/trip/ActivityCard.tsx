"use client";

import { ArchiveRestore, CircleCheck, Clock, ExternalLink, GripVertical, Lightbulb, MapPin, Pencil, Pin, Shuffle, Star, StickyNote, ThumbsDown, ThumbsUp, Ticket, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { experienceLinks, mapsSearchUrl, reviewsLink, trackedHref } from "@/lib/booking";
import type { FxSnapshot } from "@/lib/currency";
import { formatMoney } from "@/lib/currency";
import { clock, fromMinutes } from "@/lib/schedule";
import type { VoteTally } from "@/lib/storage";
import type { Activity } from "@/lib/types";
import { CATEGORY_META } from "../meta";
import { PlacePhoto } from "./PlacePhoto";

export interface ActivityTime {
  start: number;
  end: number;
  pinned?: boolean;
  conflict?: string;
  overflow?: boolean;
}

export interface ActivityActions {
  onSwap?: () => void;
  onEdit?: () => void;
  /** Takes the stop out of the plan and into Ideas, so nothing is lost. */
  onRemove: () => void;
  onToggleBooked: () => void;
  onSetStart?: (hhmm: string | undefined) => void;
  /** Present on shared trips: the group's votes and a way to cast yours. */
  votes?: VoteTally;
  onVote?: (value: -1 | 0 | 1) => void;
  /** Viewers can vote but not edit. */
  readOnly?: boolean;
}

export function ActivityCard({
  activity: a,
  city,
  fx,
  tripId,
  time,
  caution,
  handle,
  extra,
  actions,
}: {
  activity: Activity;
  city: string;
  fx: FxSnapshot;
  tripId?: string;
  time?: ActivityTime;
  /** Why this stop may not suit the traveller's access needs. */
  caution?: string;
  /** Drag handle (supplied by the sortable wrapper). */
  handle?: React.ReactNode;
  /** Extra content under the description, e.g. history and facts. */
  extra?: React.ReactNode;
  actions: ActivityActions;
}) {
  const meta = CATEGORY_META[a.category] ?? CATEGORY_META.free;
  const Icon = meta.icon;
  const isTransit = a.category === "transit";
  const isFree = a.category === "free";
  const ticket = a.bookable ? experienceLinks(city, a.title, fx.currency)[0] : undefined;
  const ticketUrl = ticket ? trackedHref({ ...ticket, valueUSD: a.estCost }, tripId) : undefined;
  const reviewsUrl = !isTransit && !isFree ? trackedHref(reviewsLink(a.title, city, fx.currency), tripId) : undefined;
  // Restaurants added from the food guide share names with people and other places; match strictly.
  const restaurant = a.ref?.startsWith("food:");
  const v = actions.votes;
  const [editingTime, setEditingTime] = useState(false);

  return (
    <div className="group relative flex gap-3 sm:gap-4">
      <div className="flex flex-col items-center">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${meta.tone}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="mt-2 w-px flex-1 bg-line" />
      </div>
      <div className={`mb-4 min-w-0 flex-1 rounded-2xl border bg-surface p-4 transition hover:shadow-card ${time?.overflow ? "border-amber-300" : "border-line"} ${isFree ? "border-dashed bg-transparent" : ""}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted">
          {time ? (
            editingTime && actions.onSetStart ? (
              <span className="no-print inline-flex items-center gap-1.5">
                <input
                  type="time"
                  autoFocus
                  defaultValue={fromMinutes(time.start)}
                  aria-label="Start time"
                  className="rounded-lg border border-line px-2 py-1 text-xs text-ink"
                  onKeyDown={(e) => e.key === "Escape" && setEditingTime(false)}
                  onBlur={(e) => {
                    if (e.target.value) actions.onSetStart!(e.target.value);
                    setEditingTime(false);
                  }}
                />
                {time.pinned && (
                  <button type="button" className="font-semibold text-brand" onMouseDown={(e) => e.preventDefault()} onClick={() => { actions.onSetStart!(undefined); setEditingTime(false); }}>
                    Auto
                  </button>
                )}
              </span>
            ) : (
              <button
                type="button"
                disabled={!actions.onSetStart || actions.readOnly}
                onClick={() => setEditingTime(true)}
                title={actions.onSetStart && !actions.readOnly ? "Change start time" : undefined}
                className="inline-flex items-center gap-1 font-semibold tracking-wide text-ink-soft enabled:hover:text-ink"
              >
                {time.pinned && <Pin className="h-3 w-3 text-brand" />}
                {clock(time.start)} – {clock(time.end)}
              </button>
            )
          ) : (
            <span className="font-semibold tracking-wide text-ink-soft uppercase">{a.slot}</span>
          )}
          {!isTransit && !isFree && <span>{meta.label}</span>}
          {!isFree && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{a.durationHrs}h</span>}
          {!isTransit && !isFree && <span>{a.estCost ? formatMoney(a.estCost, fx, { approx: true }) : "Free"}</span>}
          {a.booked && <span className="inline-flex items-center gap-1 text-sea"><CircleCheck className="h-3.5 w-3.5" /> Booked</span>}
          {handle && !actions.readOnly && <span className="no-print ml-auto">{handle}</span>}
        </div>
        {(time?.conflict || time?.overflow) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <TriangleAlert className="h-3.5 w-3.5" /> {time.conflict ?? "Runs past the end of the day, or past your flight cut-off."}
          </p>
        )}
        {caution && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800" title="Based on Giro's guidance. Check with the venue.">
            <TriangleAlert className="h-3.5 w-3.5" /> {caution}: may not suit your access needs
          </p>
        )}
        <div className="mt-1.5 flex gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-[17px] leading-snug font-semibold">{a.title}</h4>
            {a.description && a.description !== "Added by you." && <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{a.description}</p>}
          </div>
          {!isTransit && !isFree && <PlacePhoto title={a.title} city={city} durationHrs={a.durationHrs} query={{ strict: restaurant }} className="mt-0.5 h-20 w-24 sm:h-24 sm:w-32" />}
        </div>
        {a.note && (
          <p className="mt-2.5 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm whitespace-pre-line text-amber-950">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> <span><span className="sr-only">Note: </span>{a.note}</span>
          </p>
        )}
        {a.tip && (
          <p className="mt-2.5 flex gap-2 rounded-xl bg-sand/70 px-3 py-2 text-sm text-ink-soft">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {a.tip}
          </p>
        )}
        {extra}
        <div className="no-print mt-3 flex flex-wrap items-center gap-1.5">
          {a.area && !isTransit && (
            <a href={mapsSearchUrl(`${isFree ? a.area : a.title}, ${city}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-sand">
              <MapPin className="h-3.5 w-3.5" /> {a.area}
            </a>
          )}
          {ticketUrl && (
            <a href={ticketUrl} target="_blank" rel="noopener noreferrer sponsored" className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark hover:bg-brand/15">
              <Ticket className="h-3.5 w-3.5" /> Get tickets <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {reviewsUrl && (
            <a href={reviewsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-sand">
              <Star className="h-3.5 w-3.5" /> Reviews
            </a>
          )}
          {actions.onVote && !isTransit && (
            <span className="ml-1 flex items-center gap-0.5 rounded-full border border-line px-1" title={v?.upBy.length ? `In: ${v.upBy.join(", ")}` : "Vote"}>
              <button type="button" aria-label="Vote for this" aria-pressed={v?.mine === 1} onClick={() => actions.onVote!(v?.mine === 1 ? 0 : 1)} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-xs font-semibold transition ${v?.mine === 1 ? "text-sea" : "text-muted hover:text-ink"}`}>
                <ThumbsUp className="h-3.5 w-3.5" /> {v?.up || ""}
              </button>
              <button type="button" aria-label="Vote against this" aria-pressed={v?.mine === -1} onClick={() => actions.onVote!(v?.mine === -1 ? 0 : -1)} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-xs font-semibold transition ${v?.mine === -1 ? "text-brand-dark" : "text-muted hover:text-ink"}`}>
                <ThumbsDown className="h-3.5 w-3.5" /> {v?.down || ""}
              </button>
            </span>
          )}
          {!actions.readOnly && (
            <span className="ml-auto flex items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
              {a.bookable && <IconBtn label={a.booked ? "Mark as not booked" : "Mark as booked"} onClick={actions.onToggleBooked}><CircleCheck className={`h-4 w-4 ${a.booked ? "text-sea" : ""}`} /></IconBtn>}
              {actions.onEdit && <IconBtn label="Edit stop or add a note" onClick={actions.onEdit}><Pencil className="h-4 w-4" /></IconBtn>}
              {actions.onSwap && <IconBtn label="Swap for something else" onClick={actions.onSwap}><Shuffle className="h-4 w-4" /></IconBtn>}
              {!isTransit && <IconBtn label="Move to Ideas" onClick={actions.onRemove}><ArchiveRestore className="h-4 w-4" /></IconBtn>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function DragHandle(props: React.ComponentProps<"button">) {
  return (
    <button type="button" aria-label="Drag to reorder" title="Drag to move" className="grid h-7 w-7 cursor-grab touch-none place-items-center rounded-full text-muted hover:bg-sand hover:text-ink active:cursor-grabbing" {...props}>
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-sand hover:text-ink disabled:opacity-30">
      {children}
    </button>
  );
}
