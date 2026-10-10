"use client";

import { useEffect, useState } from "react";
import type { TourOffer } from "./tours";

const cache = new Map<string, Promise<TourOffer | null>>();
let disabled = false;

/** A matched bookable tour for a stop (when the server has a partner key); null when none matches. */
export function useTour(title: string, city: string, currency: string, wanted: boolean): TourOffer | null | undefined {
  const [offer, setOffer] = useState<TourOffer | null>();
  const key = `${title}|${city}|${currency}`;
  useEffect(() => {
    if (!wanted || disabled) return;
    let live = true;
    if (!cache.has(key)) {
      cache.set(
        key,
        fetch(`/api/tours?${new URLSearchParams({ title, city, cur: currency })}`)
          .then((r) => (r.ok ? r.json() : { tour: null }))
          .then((j: { enabled?: boolean; tour?: TourOffer | null }) => {
            if (j.enabled === false) disabled = true;
            return j.tour ?? null;
          })
          .catch(() => null),
      );
    }
    cache.get(key)!.then((o) => live && setOffer(o));
    return () => {
      live = false;
    };
  }, [key, wanted]); // eslint-disable-line react-hooks/exhaustive-deps
  return offer;
}
