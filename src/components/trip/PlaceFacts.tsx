"use client";

import { BookOpen, ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { PlaceInfo } from "@/lib/place-parse";
import { placeInfo } from "@/lib/places-client";
import type { Activity } from "@/lib/types";
import { photoCredit } from "./PlacePhoto";

/** Collapsible "History & facts" for a stop, loaded on first open. */
export function PlaceFacts({ activity, city }: { activity: Activity; city: string }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<PlaceInfo>();

  useEffect(() => {
    if (open && !info) placeInfo(activity, city, { facts: true }).then(setInfo);
  }, [open, info, activity, city]);

  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="no-print inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
        <BookOpen className="h-3.5 w-3.5" /> History & facts <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-line bg-paper/70 p-3 text-sm">
          {!info ? (
            <p className="animate-pulse text-muted">Looking it up…</p>
          ) : info.extract ? (
            <PlaceStory info={info} />
          ) : (
            <p className="text-muted">We couldn&apos;t find a reliable write-up for this one yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function PlaceStory({ info, compact }: { info: PlaceInfo; compact?: boolean }) {
  return (
    <div className="flex gap-3">
      {info.thumbnail && !compact && (
        <figure className="w-24 shrink-0">
          <a href={info.photo?.page ?? info.url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={info.thumbnail} alt={info.title ?? ""} loading="lazy" className="h-24 w-24 rounded-lg object-cover" />
          </a>
          <figcaption className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted">{photoCredit(info.photo)}</figcaption>
        </figure>
      )}
      <div className="min-w-0 flex-1">
        {info.description && <p className="text-xs font-semibold tracking-wide text-muted uppercase">{info.description}</p>}
        <p className="mt-1 leading-relaxed text-ink-soft">{info.extract}</p>
        {info.facts && info.facts.length > 0 && (
          <ul className="mt-2 space-y-1">
            {info.facts.map((f) => (
              <li key={f} className="flex gap-2 text-ink-soft"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />{f}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted">
          From Wikipedia{info.title ? ` (“${info.title}”)` : ""}, <a href="https://creativecommons.org/licenses/by-sa/4.0/" className="underline" rel="noopener noreferrer license">CC BY-SA 4.0</a>
          {info.facts?.length ? ". Facts summarised from the same text" : ""}.
          {info.url && (
            <> <a href={info.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-ink-soft underline">Read more <ExternalLink className="h-3 w-3" /></a></>
          )}
        </p>
      </div>
    </div>
  );
}
