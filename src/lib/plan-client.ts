"use client";

import { curateTrip } from "./curate";
import { saveTrip } from "./storage";
import type { Trip, TripRequest } from "./types";

export type PlanNotice = "ai-unavailable" | "ai-failed" | undefined;

let aiStatus: Promise<boolean> | undefined;

/** Whether this deployment has Giro AI configured (cached per page load). */
export function checkAI(): Promise<boolean> {
  aiStatus ??= fetch("/api/curate", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { ai: false }))
    .then((j: { ai?: boolean }) => Boolean(j.ai))
    .catch(() => false);
  return aiStatus;
}

/** Curate with Claude when requested and available; otherwise (or on failure) use the built-in engine. */
export async function planTrip(req: TripRequest): Promise<{ trip: Trip; notice: PlanNotice }> {
  let notice: PlanNotice;
  if (req.useAI) {
    try {
      const res = await fetch("/api/curate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
      if (res.ok) {
        const { trip } = (await res.json()) as { trip: Trip };
        saveTrip(trip);
        return { trip, notice: undefined };
      }
      notice = res.status === 503 ? "ai-unavailable" : "ai-failed";
    } catch {
      notice = "ai-failed";
    }
  }
  const trip = curateTrip({ ...req, useAI: false });
  saveTrip(trip);
  return { trip, notice };
}
