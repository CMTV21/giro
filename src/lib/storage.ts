"use client";

import type { Trip } from "./types";

const KEY = "giro.trips.v1";

// Keeps trips reachable during client-side navigation even when localStorage is unavailable.
const memory = new Map<string, Trip>();

/** Trips are kept in the browser for now; swap this module for an API call when accounts land. */
export function loadTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Trip[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadTrip(id: string): Trip | undefined {
  return loadTrips().find((t) => t.id === id) ?? memory.get(id);
}

export function saveTrip(trip: Trip): boolean {
  memory.set(trip.id, trip);
  try {
    const trips = loadTrips().filter((t) => t.id !== trip.id);
    localStorage.setItem(KEY, JSON.stringify([trip, ...trips].slice(0, 50)));
    return true;
  } catch {
    return false;
  }
}

export function deleteTrip(id: string): void {
  memory.delete(id);
  try {
    localStorage.setItem(KEY, JSON.stringify(loadTrips().filter((t) => t.id !== id)));
  } catch {
    /* storage unavailable */
  }
}
