"use client";

import { Accessibility, CalendarClock, ExternalLink, Globe, Info, Lightbulb, MapPin, Star, Ticket, X } from "lucide-react";
import { useEffect, useState } from "react";
import { detailsFor } from "@/lib/activity-details";
import { mapsSearchUrl } from "@/lib/booking";
import { money } from "@/lib/money";
import type { PlaceInfo } from "@/lib/place-parse";
import { googlePhotos, placeInfo, type GooglePhoto } from "@/lib/places-client";
import type { Activity, Trip } from "@/lib/types";
import { PlaceFacts } from "./PlaceFacts";
import { photoCredit } from "./PlacePhoto";

const OPEN_EVENT = "giro:open-details";

/** Open the details panel for a stop or idea (e.g. when its photo is clicked). */
export function openDetails(activityId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: activityId }));
}

/** The "Details" button on a stop or idea, and the panel it opens. */
export function StopDetails({ activity, city, trip, className = "" }: { activity: Activity; city: string; trip: Pick<Trip, "fx">; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = (e: Event) => (e as CustomEvent<string>).detail === activity.id && setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [activity.id]);
  if (activity.category === "transit" || (activity.category === "free" && !activity.area)) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`no-print inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink ${className}`}>
        <Info className="h-3.5 w-3.5" /> Details, photos & history
      </button>
      {open && <DetailsDialog activity={activity} city={city} trip={trip} onClose={() => setOpen(false)} />}
    </>
  );
}

interface GoogleDetails {
  name?: string;
  address?: string;
  rating?: number;
  ratingCount?: number;
  priceLevel?: number;
  website?: string;
  mapsUrl: string;
  weekdays?: string[];
}

interface Photo {
  src: string;
  credit: string;
  href?: string;
  google: boolean;
}

function DetailsDialog({ activity: a, city, trip, onClose }: { activity: Activity; city: string; trip: Pick<Trip, "fx">; onClose: () => void }) {
  const written = detailsFor(a, city);
  const place = a.category === "free" ? a.area! : a.title;
  const [photos, setPhotos] = useState<Photo[]>();
  const [current, setCurrent] = useState(0);
  const [google, setGoogle] = useState<GoogleDetails | null>();

  useEffect(() => {
    let live = true;
    (async () => {
      const g: GooglePhoto[] = await googlePhotos(place, city, 4, 1200);
      if (g.length) {
        if (live) setPhotos(g.map((p) => ({ src: p.src, credit: p.author ? `${p.author} · Google Maps` : "Google Maps", href: p.authorUrl, google: true })));
        return;
      }
      const w: PlaceInfo = await placeInfo({ title: place, durationHrs: a.durationHrs }, city);
      if (live) setPhotos(w.thumbnail ? [{ src: w.thumbnail, credit: photoCredit(w.photo).replace(/^Photo: /, ""), href: w.photo?.page ?? w.url, google: false }] : []);
    })();
    fetch(`/api/place/details?${new URLSearchParams({ title: place, city })}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((j: { details?: GoogleDetails | null }) => live && setGoogle(j.details ?? null))
      .catch(() => live && setGoogle(null));
    return () => {
      live = false;
    };
  }, [place, city, a.durationHrs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const photo = photos?.[current];
  const facts = [
    written?.bestTime && { icon: CalendarClock, label: "Best time", text: written.bestTime },
    written?.tickets && { icon: Ticket, label: "Tickets", text: written.tickets },
    written?.access && { icon: Accessibility, label: "Getting around", text: written.access },
    a.tip && { icon: Lightbulb, label: "Local tip", text: a.tip },
  ].filter(Boolean) as { icon: typeof Info; label: string; text: string }[];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="stop-details-title" className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-2 sm:p-4" onClick={onClose}>
      <div className="card max-h-[92dvh] w-full max-w-2xl overflow-y-auto text-ink" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          {photos === undefined ? (
            <div className="aspect-[16/9] w-full animate-pulse rounded-t-2xl bg-sand" />
          ) : photo ? (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-2xl bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.src} alt={a.title} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-6 pb-1.5 text-[11px] text-white/90">
                {photo.href ? <a href={photo.href} target="_blank" rel="noopener noreferrer" className="hover:underline">Photo: {photo.credit}</a> : <>Photo: {photo.credit}</>}
              </span>
            </div>
          ) : null}
          <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-white"><X className="h-4 w-4" /></button>
        </div>
        {photos && photos.length > 1 && (
          <div className="flex gap-2 px-5 pt-3 sm:px-6" role="tablist" aria-label="Photos">
            {photos.map((p, i) => (
              <button key={p.src} type="button" role="tab" aria-selected={i === current} aria-label={`Photo ${i + 1}`} onClick={() => setCurrent(i)} className={`h-14 w-20 overflow-hidden rounded-lg ring-offset-2 ${i === current ? "ring-2 ring-brand" : "opacity-80 hover:opacity-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 id="stop-details-title" className="font-display text-2xl font-semibold">{a.title}</h2>
            <p className="mt-1 text-sm text-muted">{[a.area, city, `${a.durationHrs}h`, a.estCost ? `about ${money(trip, a.estCost)} per adult` : "Free"].filter(Boolean).join(" · ")}</p>
            {google?.rating !== undefined && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> <span className="font-semibold">{google.rating.toFixed(1)}</span>
                {google.ratingCount !== undefined && <span className="text-muted">({google.ratingCount.toLocaleString("en-CA")} reviews on Google)</span>}
                {google.priceLevel && <span className="text-muted">· {"$".repeat(google.priceLevel)}</span>}
              </p>
            )}
          </div>

          <div className="space-y-2 text-[15px] leading-relaxed text-ink-soft">
            {a.description && a.description !== "Added by you." && <p>{a.description}</p>}
            {written?.about && <p>{written.about}</p>}
          </div>

          {facts.length > 0 && (
            <dl className="grid gap-3 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label} className="rounded-xl bg-sand/60 p-3">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase"><f.icon className="h-3.5 w-3.5 text-brand" /> {f.label}</dt>
                  <dd className="mt-1 text-sm text-ink-soft">{f.text}</dd>
                </div>
              ))}
            </dl>
          )}

          {google === undefined ? (
            <p className="animate-pulse text-sm text-muted">Checking Google Maps…</p>
          ) : google ? (
            <section className="rounded-xl border border-line p-4 text-sm" aria-label="From Google Maps">
              {google.address && <p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" /> {google.address}</p>}
              {google.weekdays && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-semibold text-ink-soft">Opening hours</summary>
                  <ul className="mt-1 space-y-0.5 text-ink-soft">{google.weekdays.map((d) => <li key={d}>{d}</li>)}</ul>
                </details>
              )}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {google.website && <a href={google.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"><Globe className="h-3.5 w-3.5" /> Official site</a>}
                <a href={google.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Open in Google Maps</a>
              </div>
              <p className="mt-3 text-[11px] text-muted">Rating, address and hours from Google Maps. Check before you go.</p>
            </section>
          ) : (
            <a href={mapsSearchUrl(`${place}, ${city}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Open in Google Maps</a>
          )}

          <PlaceFacts activity={a} city={city} />
        </div>
      </div>
    </div>
  );
}
