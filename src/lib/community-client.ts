"use client";

import { useEffect, useState } from "react";

export interface CommunityPick {
  travellers: number;
  booked: number;
}
export type CommunityPicks = Record<string, CommunityPick>;

const cache = new Map<string, Promise<CommunityPicks>>();

function load(city: string): Promise<CommunityPicks> {
  const key = city.toLowerCase();
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/community?city=${encodeURIComponent(city)}`)
      .then((r) => (r.ok ? r.json() : { picks: {} }))
      .then((j: { picks?: CommunityPicks }) => j.picks ?? {})
      .catch(() => ({}));
    cache.set(key, p);
  }
  return p;
}

/** Community picks for a city (empty until enough travellers agree on something). */
export function useCommunity(city: string | undefined): CommunityPicks {
  const [picks, setPicks] = useState<CommunityPicks>({});
  useEffect(() => {
    let live = true;
    if (city) load(city).then((p) => live && setPicks(p));
    return () => {
      live = false;
    };
  }, [city]);
  return picks;
}

export const lovedLabel = (p: CommunityPick) => `Loved by ${p.travellers} Giro travellers`;
