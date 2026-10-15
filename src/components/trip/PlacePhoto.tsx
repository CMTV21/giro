"use client";

import { useEffect, useRef, useState } from "react";
import type { PhotoCredit, PlaceInfo } from "@/lib/place-parse";
import { googlePhotos, placeInfo, type GooglePhoto, type PlaceQuery } from "@/lib/places-client";

/** "Photo: Jane Doe, CC BY-SA 4.0" linking to the Commons file page. */
export function photoCredit(photo?: PhotoCredit): string {
  return ["Photo", [photo?.author, photo?.license].filter(Boolean).join(", ") || "Wikimedia Commons"].join(": ");
}

/** What's shown on a photo: the photographer, and where it came from. */
interface Shown {
  src: string;
  alt: string;
  credit: string;
  title: string;
}

const fromGoogle = (g: GooglePhoto, alt: string): Shown => ({
  src: g.src,
  alt,
  credit: g.author ? `${g.author} · Google Maps` : "Google Maps",
  title: g.author ? `Photo: ${g.author} (Google Maps)` : "Photo from Google Maps",
});

const fromWiki = (info: PlaceInfo, alt: string): Shown | undefined =>
  info.thumbnail ? { src: info.thumbnail, alt: info.title ?? alt, credit: info.photo?.author ?? "Wikimedia Commons", title: photoCredit(info.photo) } : undefined;

/**
 * A place's photo, fetched only when the element scrolls near the viewport so a long itinerary
 * doesn't fire dozens of lookups at once. Google's photo of the place comes first; Wikimedia
 * Commons is the fallback (and the only source for `source="wiki"`, e.g. dishes). Renders nothing
 * when neither has one.
 */
export function PlacePhoto({
  title,
  city,
  query,
  className = "h-20 w-24",
  rounded = "rounded-xl",
  durationHrs = 2,
  source = "google",
  width = 480,
  onOpen,
}: {
  title: string;
  city: string;
  query?: PlaceQuery;
  className?: string;
  rounded?: string;
  durationHrs?: number;
  /** "wiki" skips Google, for things that aren't a single place (a dish, a neighbourhood). */
  source?: "google" | "wiki";
  width?: number;
  /** What a click on the photo does, e.g. open the stop's details panel. Without it the photo isn't clickable. */
  onOpen?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<Shown | null>();
  const [failed, setFailed] = useState(false);
  const strict = query?.strict;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const load = async () => {
      const google = source === "google" ? (await googlePhotos(title, city, 1, width))[0] : undefined;
      const next = google ? fromGoogle(google, title) : fromWiki(await placeInfo({ title, durationHrs }, city, { strict }), title);
      if (live) setShown(next ?? null);
    };
    if (typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        live = false;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, [title, city, strict, durationHrs, source, width]);

  // Reserve no space until we know there's a photo, so text-only cards don't show empty boxes.
  if (shown === null || failed) return <div ref={ref} hidden />;
  return (
    <div ref={ref} className={`relative shrink-0 overflow-hidden bg-sand ${rounded} ${className} ${shown ? "" : "animate-pulse"}`}>
      {shown && <PhotoImage shown={shown} onOpen={onOpen} onError={() => setFailed(true)} />}
    </div>
  );
}

/** The image with its credit on it (CC licences and Google both require attribution). */
function PhotoImage({ shown, onOpen, onError }: { shown: Shown; onOpen?: () => void; onError: () => void }) {
  const img = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shown.src} alt={shown.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={onError} className="h-full w-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pt-3 pb-0.5 text-[9px] leading-tight text-white/90">{shown.credit}</span>
    </>
  );
  // The photographer's profile link lives in the details panel's credit, not on small thumbnails.
  return onOpen ? (
    <button type="button" onClick={onOpen} title={`${shown.title}. Open details and more photos`} aria-label={`More photos and details: ${shown.alt}`} className="block h-full w-full cursor-zoom-in">{img}</button>
  ) : (
    <span title={shown.title} className="block h-full w-full">{img}</span>
  );
}
