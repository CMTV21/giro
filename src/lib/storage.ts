"use client";

import type { Trip } from "./types";

/**
 * Trip persistence. Signed-in travellers save to their account (and can share with a group);
 * everyone else saves in this browser. Callers don't need to know which.
 */

const KEY = "giro.trips.v1";

// Keeps trips reachable during client-side navigation even when localStorage is unavailable.
const memory = new Map<string, Trip>();

export type Role = "owner" | "editor" | "viewer";

export interface Member {
  id: string;
  name: string;
  role: Role;
}

export interface VoteTally {
  up: number;
  down: number;
  mine: -1 | 0 | 1;
  upBy: string[];
}

export interface Expense {
  id: string;
  paidBy: string;
  amount: number;
  currency: string;
  amountUSD: number;
  description: string;
  splitBetween: string[];
  createdBy: string;
  createdAt: string;
  receiptIds?: string[];
}

/** A trip as the trip page sees it: the document plus, for account trips, the group around it. */
export interface TripBundle {
  trip: Trip;
  remote: boolean;
  version: number;
  role: Role;
  me?: string;
  members: Member[];
  votes: Record<string, VoteTally>;
  expenses: Expense[];
  balancesUSD: Record<string, number>;
  settleUSD: { from: string; to: string; amount: number }[];
}

export interface TripSummary {
  trip: Trip;
  role: Role;
  memberCount: number;
  remote: boolean;
}

// ---- browser storage -------------------------------------------------------

export function loadLocalTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Trip[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocal(trip: Trip): void {
  memory.set(trip.id, trip);
  try {
    const trips = loadLocalTrips().filter((t) => t.id !== trip.id);
    localStorage.setItem(KEY, JSON.stringify([trip, ...trips].slice(0, 50)));
  } catch {
    /* storage unavailable: memory copy keeps the session working */
  }
}

function deleteLocal(id: string): void {
  memory.delete(id);
  try {
    localStorage.setItem(KEY, JSON.stringify(loadLocalTrips().filter((t) => t.id !== id)));
  } catch {
    /* storage unavailable */
  }
}

const localBundle = (trip: Trip): TripBundle => ({ trip, remote: false, version: 0, role: "owner", members: [], votes: {}, expenses: [], balancesUSD: {}, settleUSD: [] });

// ---- API helpers -------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers }, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new ApiError(res.status, json.error ?? "error", json.message ?? "Something went wrong.");
  return json as T;
}

// ---- public API ---------------------------------------------------------------

export async function listTrips(): Promise<TripSummary[]> {
  const local = loadLocalTrips().map((trip) => ({ trip, role: "owner" as const, memberCount: 1, remote: false }));
  try {
    const { trips } = await api<{ trips: { trip: Trip; role: Role; memberCount: number }[] }>("/api/trips");
    const remote = trips.map((t) => ({ ...t, remote: true }));
    const ids = new Set(remote.map((t) => t.trip.id));
    return [...remote, ...local.filter((t) => !ids.has(t.trip.id))];
  } catch {
    return local;
  }
}

/** Load a trip: from the account when signed in and it's there, else from this browser. */
export async function fetchTrip(id: string): Promise<TripBundle | undefined> {
  try {
    const b = await api<Omit<TripBundle, "remote">>(`/api/trips/${encodeURIComponent(id)}`);
    return { ...b, remote: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) throw err;
    const local = loadLocalTrips().find((t) => t.id === id) ?? memory.get(id);
    return local ? localBundle(local) : undefined;
  }
}

/** Save a newly planned or imported trip. Returns the stored trip (its id can change on import). */
export async function saveTrip(trip: Trip): Promise<Trip> {
  try {
    const { trip: saved } = await api<{ trip: Trip; version: number }>("/api/trips", { method: "POST", body: JSON.stringify(trip) });
    deleteLocal(trip.id);
    memory.set(saved.id, saved);
    return saved;
  } catch (err) {
    if (err instanceof ApiError && err.status !== 401) console.warn("Saving to account failed; keeping in this browser.", err.message);
    saveLocal(trip);
    return trip;
  }
}

/** Persist edits. Account trips use optimistic concurrency and report conflicts. */
export async function updateTrip(bundle: TripBundle, trip: Trip): Promise<{ version: number } | { conflict: true }> {
  if (!bundle.remote) {
    saveLocal(trip);
    return { version: 0 };
  }
  try {
    return await api<{ version: number }>(`/api/trips/${encodeURIComponent(trip.id)}`, { method: "PUT", body: JSON.stringify({ trip, version: bundle.version }) });
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) return { conflict: true };
    throw err;
  }
}

export async function deleteTrip(bundle: Pick<TripBundle, "remote" | "trip">): Promise<void> {
  if (bundle.remote) await api(`/api/trips/${encodeURIComponent(bundle.trip.id)}`, { method: "DELETE" });
  deleteLocal(bundle.trip.id);
}

/** After signing in, move trips saved in this browser into the account. */
export async function importLocalTrips(): Promise<number> {
  let moved = 0;
  for (const trip of loadLocalTrips()) {
    try {
      await api("/api/trips", { method: "POST", body: JSON.stringify(trip) });
      deleteLocal(trip.id);
      moved++;
    } catch {
      /* keep it locally and try again next sign-in */
    }
  }
  return moved;
}

/** Save a trip into this browser only (used by share links when signed out). */
export const saveTripLocally = saveLocal;
