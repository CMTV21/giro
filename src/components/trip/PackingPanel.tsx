"use client";

import { Backpack, Check, ExternalLink, Lightbulb, NotebookPen, Plus, RotateCcw, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { esimLink, trackedHref } from "@/lib/booking";
import { findDestination } from "@/lib/destinations";
import { addPackingItem, packingItems, removePackingItem, restoreSuggestions } from "@/lib/packing";
import type { Trip } from "@/lib/types";
import { HeadsUpCard } from "./HeadsUp";

// Packing is personal, even on a shared trip, so ticks live with each traveller rather than in the trip.
const key = (tripId: string) => `giro.packed.${tripId}`;

function loadPacked(trip: Trip): string[] {
  try {
    const raw = localStorage.getItem(key(trip.id));
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* storage unavailable */
  }
  return trip.packed ?? [];
}

export function PackingPanel({ trip, onChange, readOnly, shared }: { trip: Trip; onChange: (t: Trip) => void; readOnly?: boolean; shared?: boolean }) {
  const [packed, setPacked] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  useEffect(() => setPacked(new Set(loadPacked(trip))), [trip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (item: string) => {
    const next = new Set(packed);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setPacked(next);
    try {
      localStorage.setItem(key(trip.id), JSON.stringify([...next]));
    } catch {
      /* storage unavailable */
    }
  };
  const items = packingItems(trip);
  const done = items.filter((p) => packed.has(p.item)).length;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TripNotes trip={trip} onChange={onChange} readOnly={readOnly} shared={shared} />
      <section className="card p-5 sm:p-6 lg:row-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold"><Backpack className="h-4 w-4" /> Packing list</h3>
          <span className="text-sm text-muted tabular-nums">{done}/{items.length} packed</span>
        </div>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-sea transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
        <ul className="space-y-1">
          {items.map(({ item, added }) => {
            const on = packed.has(item);
            return (
              <li key={item} className="group flex items-center gap-1">
                <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(item)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left text-[15px] transition hover:bg-sand/60">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${on ? "border-sea bg-sea text-white" : "border-line bg-surface"}`}>
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  <span className={on ? "text-muted line-through" : ""}>{item}</span>
                  {added && <span className="ml-auto shrink-0 rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold text-ink-soft">Added</span>}
                </button>
                {!readOnly && (
                  <button type="button" aria-label={`Remove ${item}`} title="Remove from the list" onClick={() => onChange(removePackingItem(trip, item))} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted opacity-100 transition hover:bg-sand hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {!readOnly && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const r = addPackingItem(trip, draft);
              setError(r.error);
              if (r.trip !== trip) onChange(r.trip);
              if (!r.error) setDraft("");
            }}
          >
            <input className="field py-2" placeholder="Add an item, e.g. snorkel mask" aria-label="New packing item" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={120} />
            <button type="submit" className="btn-dark shrink-0 py-2" disabled={!draft.trim()}><Plus className="h-4 w-4" /> Add</button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-brand-dark" role="alert">{error}</p>}
        <p className="mt-3 text-xs text-muted">
          {shared ? "Items you add or remove change the list for everyone on the trip; ticks are just yours." : "Ticks are saved on this device."}
          {!readOnly && (trip.packingRemoved?.length ?? 0) > 0 && (
            <button type="button" onClick={() => onChange(restoreSuggestions(trip))} className="ml-2 inline-flex items-center gap-1 font-semibold text-ink-soft hover:text-ink">
              <RotateCcw className="h-3 w-3" /> Restore {trip.packingRemoved!.length} removed suggestion{trip.packingRemoved!.length > 1 ? "s" : ""}
            </button>
          )}
        </p>
      </section>
      <HeadsUpCard cities={trip.days.map((d) => d.city)} />
      <StayConnected trip={trip} />
      <section className="card p-5 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold"><Lightbulb className="h-4 w-4" /> Good to know</h3>
        <ul className="space-y-3">
          {trip.tips.map((tip) => (
            <li key={tip} className="flex gap-3 text-[15px] leading-relaxed text-ink-soft">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              {tip}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const SAVE_AFTER_MS = 1200;

/** The trip's notepad. Typing stays local and saves after a pause or on leaving the box, so a group sync can't overwrite it mid-sentence. */
function TripNotes({ trip, onChange, readOnly, shared }: { trip: Trip; onChange: (t: Trip) => void; readOnly?: boolean; shared?: boolean }) {
  const [text, setText] = useState(trip.notes ?? "");
  const [status, setStatus] = useState<"idle" | "pending" | "saved">("idle");
  const editing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(trip);
  latest.current = trip;

  // Take in changes from others when the traveller isn't typing.
  useEffect(() => {
    if (!editing.current && status !== "pending") setText(trip.notes ?? "");
  }, [trip.notes]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (value: string) => {
    clearTimeout(timer.current);
    const notes = value.trim() ? value.slice(0, 5000) : undefined;
    if ((latest.current.notes ?? undefined) !== notes) onChange({ ...latest.current, notes });
    setStatus("saved");
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold"><NotebookPen className="h-4 w-4" /> Trip notes</h3>
        <span className="text-xs text-muted" aria-live="polite">{status === "pending" ? "Saving…" : status === "saved" ? "Saved" : ""}</span>
      </div>
      {readOnly ? (
        trip.notes ? <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">{trip.notes}</p> : <p className="text-sm text-muted">No notes yet.</p>
      ) : (
        <>
          <textarea
            rows={8}
            maxLength={5000}
            className="field resize-y text-[15px] leading-relaxed"
            placeholder={"Flight numbers, insurance policy, who's bringing what, restaurants to try…"}
            aria-label="Trip notes"
            value={text}
            onFocus={() => (editing.current = true)}
            onBlur={() => {
              editing.current = false;
              save(text);
            }}
            onChange={(e) => {
              const v = e.target.value;
              setText(v);
              setStatus("pending");
              clearTimeout(timer.current);
              timer.current = setTimeout(() => save(v), SAVE_AFTER_MS);
            }}
          />
          <p className="mt-1.5 text-xs text-muted">{shared ? "Everyone on this trip can read and edit these notes." : "Saved with the trip and printed in your guide."} Notes on individual stops live on each stop (pencil icon).</p>
        </>
      )}
    </section>
  );
}

/** Travel eSIMs for each country on the trip, so maps and messages work from the airport. */
function StayConnected({ trip }: { trip: Trip }) {
  const countries = [...new Set(trip.days.map((d) => findDestination(d.city)?.country).filter((c): c is string => Boolean(c)))];
  const links = countries.map(esimLink).filter((l): l is NonNullable<ReturnType<typeof esimLink>> => Boolean(l));
  if (!links.length) return null;
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="connected-title">
      <h3 id="connected-title" className="flex items-center gap-2 font-semibold"><Smartphone className="h-4 w-4" /> Stay connected</h3>
      <p className="mt-1 text-sm text-muted">Canadian plans can charge a lot to roam. A travel eSIM gives you data the moment you land; check your phone supports eSIM first.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((l) => (
          <a key={l.url} href={trackedHref(l, trip.id)} target="_blank" rel="noopener noreferrer sponsored" className="btn-ghost px-3.5 py-2 text-xs">{l.label} <ExternalLink className="h-3 w-3" /></a>
        ))}
      </div>
    </section>
  );
}
