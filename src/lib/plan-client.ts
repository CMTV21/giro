"use client";

import { blankTrip, curateTrip } from "./curate";
import { DEFAULT_CURRENCY, FALLBACK_AS_OF, FALLBACK_RATES, type Currency, type FxSnapshot } from "./currency";
import { saveTrip } from "./storage";
import { loadTaste } from "./taste-client";
import type { Trip, TripRequest } from "./types";

export type PlanNotice = "ai-unavailable" | "ai-failed" | undefined;

let aiStatus: Promise<boolean> | undefined;
let rateTable: Promise<{ rates: Record<Currency, number>; asOf: string; source: "live" | "fallback" }> | undefined;

/** Whether this deployment has Giro AI configured (cached per page load). */
export function checkAI(): Promise<boolean> {
  aiStatus ??= fetch("/api/curate", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { ai: false }))
    .then((j: { ai?: boolean }) => Boolean(j.ai))
    .catch(() => false);
  return aiStatus;
}

/** Today's rate for a currency (live ECB rates via the server, built-in rates as a fallback). */
export async function getFx(currency: Currency = DEFAULT_CURRENCY): Promise<FxSnapshot> {
  rateTable ??= fetch("/api/rates")
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .catch(() => ({ rates: FALLBACK_RATES, asOf: FALLBACK_AS_OF, source: "fallback" as const }));
  const t = await rateTable;
  return { currency, rate: t.rates[currency] ?? FALLBACK_RATES[currency], asOf: t.asOf, source: t.source };
}

/** Curate with Claude when requested and available; otherwise (or on failure) use the built-in engine. */
export async function planTrip(req: TripRequest): Promise<{ trip: Trip; notice: PlanNotice }> {
  const [fx, taste] = [await getFx(req.currency), loadTaste()];
  let notice: PlanNotice;
  if (req.useAI) {
    try {
      const res = await fetch("/api/curate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...req, taste }),
      });
      if (res.ok) {
        const { trip } = (await res.json()) as { trip: Trip };
        return { trip: await saveTrip(trip), notice: undefined };
      }
      notice = res.status === 503 ? "ai-unavailable" : "ai-failed";
    } catch {
      notice = "ai-failed";
    }
  }
  const trip = curateTrip({ ...req, useAI: false }, { fx, taste });
  return { trip: await saveTrip(trip), notice };
}

/** Start from scratch: the trip's structure with empty days to fill yourself. */
export async function planBlank(req: TripRequest): Promise<Trip> {
  const fx = await getFx(req.currency);
  return saveTrip(blankTrip(req, { fx }));
}
