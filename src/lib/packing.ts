import type { Trip } from "./types.ts";

/** The packing list as travellers see it: Giro's suggestions, minus removals, plus additions. */

export const MAX_PACKING_ITEMS = 60;
const norm = (s: string) => s.trim().toLowerCase();

export function packingItems(trip: Pick<Trip, "packing" | "packingAdded" | "packingRemoved">): { item: string; added: boolean }[] {
  const removed = new Set((trip.packingRemoved ?? []).map(norm));
  const suggested = trip.packing.filter((p) => !removed.has(norm(p))).map((item) => ({ item, added: false }));
  const seen = new Set(suggested.map((s) => norm(s.item)));
  const added = (trip.packingAdded ?? []).filter((a) => !seen.has(norm(a))).map((item) => ({ item, added: true }));
  return [...suggested, ...added];
}

export function addPackingItem<T extends Pick<Trip, "packing" | "packingAdded" | "packingRemoved">>(trip: T, raw: string): { trip: T; error?: string } {
  const item = raw.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!item) return { trip };
  if (packingItems(trip).some((p) => norm(p.item) === norm(item))) return { trip, error: `"${item}" is already on the list.` };
  // Re-adding a suggestion you removed just brings it back.
  if (trip.packing.some((p) => norm(p) === norm(item))) return { trip: { ...trip, packingRemoved: (trip.packingRemoved ?? []).filter((r) => norm(r) !== norm(item)) } };
  if ((trip.packingAdded ?? []).length >= MAX_PACKING_ITEMS) return { trip, error: "The list is full. Remove something first." };
  return { trip: { ...trip, packingAdded: [...(trip.packingAdded ?? []), item] } };
}

export function removePackingItem<T extends Pick<Trip, "packing" | "packingAdded" | "packingRemoved">>(trip: T, item: string): T {
  if ((trip.packingAdded ?? []).some((a) => norm(a) === norm(item))) return { ...trip, packingAdded: trip.packingAdded!.filter((a) => norm(a) !== norm(item)) };
  if (!trip.packing.some((p) => norm(p) === norm(item))) return trip;
  return { ...trip, packingRemoved: [...new Set([...(trip.packingRemoved ?? []), item])].slice(0, MAX_PACKING_ITEMS) };
}

export const restoreSuggestions = <T extends Pick<Trip, "packingRemoved">>(trip: T): T => ({ ...trip, packingRemoved: undefined });
