"use client";

import { useEffect, useRef, useState } from "react";
import type { PhotoCredit, PlaceInfo } from "@/lib/place-parse";
import { placeInfo, type PlaceQuery } from "@/lib/places-client";

/** "Photo: Jane Doe, CC BY-SA 4.0" linking to the Commons file page. */
export function photoCredit(photo?: PhotoCredit): string {
  return ["Photo", [photo?.author, photo?.license].filter(Boolean).join(", ") || "Wikimedia Commons"].join(": ");
}

/**
 * A place's photo, fetched only when the element scrolls near the viewport so a long itinerary
 * doesn't fire dozens of lookups at once. Renders nothing when there's no free-licensed photo.
 */
export function PlacePhoto({
  title,
  city,
  query,
  className = "h-20 w-24",
  rounded = "rounded-xl",
  durationHrs = 2,
}: {
  title: string;
  city: string;
  query?: PlaceQuery;
  className?: string;
  rounded?: string;
  durationHrs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<PlaceInfo>();
  const [failed, setFailed] = useState(false);
  const strict = query?.strict;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const load = () => placeInfo({ title, durationHrs }, city, { strict }).then((i) => live && setInfo(i));
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
  }, [title, city, strict, durationHrs]);

  const src = !failed ? info?.thumbnail : undefined;
  // Reserve no space until we know there's a photo, so text-only cards don't show empty boxes.
  if (info && !src) return <div ref={ref} hidden />;
  return (
    <div ref={ref} className={`relative shrink-0 overflow-hidden bg-sand ${rounded} ${className} ${info ? "" : "animate-pulse"}`}>
      {src && (
        <a href={info!.photo?.page ?? info!.url} target="_blank" rel="noopener noreferrer" title={photoCredit(info!.photo)} className="block h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={info!.title ?? title} loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />
          {/* Credit the photographer on the image itself (CC licences ask for attribution). */}
          <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pt-3 pb-0.5 text-[9px] leading-tight text-white/90">
            {info!.photo?.author ?? "Wikimedia Commons"}
          </span>
        </a>
      )}
    </div>
  );
}
