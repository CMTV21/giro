"use client";

import { ChevronDown, ChevronUp, CircleCheck, Clock, ExternalLink, Lightbulb, MapPin, Shuffle, ThumbsDown, ThumbsUp, Ticket, Trash2 } from "lucide-react";
import { experienceLinks, mapsSearchUrl, trackedHref } from "@/lib/booking";
import type { VoteTally } from "@/lib/storage";
import type { FxSnapshot } from "@/lib/currency";
import { formatMoney } from "@/lib/currency";
import type { Activity } from "@/lib/types";
import { CATEGORY_META } from "../meta";

const SLOT_LABEL = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;

export interface ActivityActions {
  onSwap?: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onToggleBooked: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Present on shared trips: the group's votes and a way to cast yours. */
  votes?: VoteTally;
  onVote?: (value: -1 | 0 | 1) => void;
  /** Viewers can vote but not edit. */
  readOnly?: boolean;
}

export function ActivityCard({ activity: a, city, fx, tripId, actions }: { activity: Activity; city: string; fx: FxSnapshot; tripId?: string; actions: ActivityActions }) {
  const meta = CATEGORY_META[a.category] ?? CATEGORY_META.free;
  const Icon = meta.icon;
  const isTransit = a.category === "transit";
  const isFree = a.category === "free";
  const ticket = a.bookable ? experienceLinks(city, a.title, fx.currency)[0] : undefined;
  const ticketUrl = ticket ? trackedHref({ ...ticket, valueUSD: a.estCost }, tripId) : undefined;
  const v = actions.votes;

  return (
    <li className="group relative flex gap-4">
      <div className="flex flex-col items-center">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${meta.tone}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="mt-2 w-px flex-1 bg-line group-last:hidden" />
      </div>
      <div className={`mb-5 flex-1 rounded-2xl border border-line bg-surface p-4 transition hover:shadow-card ${isFree ? "border-dashed bg-transparent" : ""}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted">
          <span className="font-semibold tracking-wide text-ink-soft uppercase">{SLOT_LABEL[a.slot]}</span>
          {!isTransit && !isFree && <span>{meta.label}</span>}
          {!isFree && (
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{a.durationHrs}h</span>
          )}
          {!isTransit && !isFree && <span>{a.estCost ? formatMoney(a.estCost, fx, { approx: true }) : "Free"}</span>}
          {a.booked && <span className="inline-flex items-center gap-1 text-sea"><CircleCheck className="h-3.5 w-3.5" /> Booked</span>}
        </div>
        <h4 className="mt-1.5 text-[17px] leading-snug font-semibold">{a.title}</h4>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{a.description}</p>
        {a.tip && (
          <p className="mt-2.5 flex gap-2 rounded-xl bg-sand/70 px-3 py-2 text-sm text-ink-soft">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {a.tip}
          </p>
        )}
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
          {!actions.readOnly && <span className="ml-auto flex items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
            {a.bookable && (
              <IconBtn label={a.booked ? "Mark as not booked" : "Mark as booked"} onClick={actions.onToggleBooked}><CircleCheck className={`h-4 w-4 ${a.booked ? "text-sea" : ""}`} /></IconBtn>
            )}
            {actions.onSwap && <IconBtn label="Swap for something else" onClick={actions.onSwap}><Shuffle className="h-4 w-4" /></IconBtn>}
            <IconBtn label="Move earlier" disabled={!actions.canMoveUp} onClick={() => actions.onMove(-1)}><ChevronUp className="h-4 w-4" /></IconBtn>
            <IconBtn label="Move later" disabled={!actions.canMoveDown} onClick={() => actions.onMove(1)}><ChevronDown className="h-4 w-4" /></IconBtn>
            <IconBtn label="Remove" onClick={actions.onRemove}><Trash2 className="h-4 w-4" /></IconBtn>
          </span>}
        </div>
      </div>
    </li>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-sand hover:text-ink disabled:opacity-30">
      {children}
    </button>
  );
}
