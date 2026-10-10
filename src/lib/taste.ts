import { INTERESTS, type Activity, type Interest } from "./types.ts";

/**
 * Taste profile ("Travel DNA"): a learned weight per interest, nudged by what travellers do
 * rather than what they say. Older signals decay so the profile follows changing tastes.
 */
export interface TasteProfile {
  weights: Partial<Record<Interest, number>>;
  /** Signals absorbed so far, used to decide how much to trust the profile. */
  events: number;
  updatedAt: string;
  /** Catalog stops the traveller never wants suggested again. */
  blocked?: string[];
}

export const MAX_BLOCKED = 200;
const BLOCK_KEY = /^[a-z0-9-]{1,80}$/;

export type TasteSignal = "removed" | "swapped_out" | "swapped_in" | "added" | "booked" | "voted_up" | "voted_down";

const DELTA: Record<TasteSignal, number> = {
  removed: -1,
  swapped_out: -0.6,
  swapped_in: 0.8,
  added: 0.6,
  booked: 1.2,
  voted_up: 0.5,
  voted_down: -0.5,
};

const DECAY = 0.97;
const LIMIT = 5;

export const emptyTaste = (): TasteProfile => ({ weights: {}, events: 0, updatedAt: new Date(0).toISOString() });

const isInterest = (c: string): c is Interest => (INTERESTS as readonly string[]).includes(c);

export function applySignal(profile: TasteProfile, signal: TasteSignal, category: Activity["category"]): TasteProfile {
  if (!isInterest(category)) return profile;
  const weights: Partial<Record<Interest, number>> = {};
  for (const [k, v] of Object.entries(profile.weights) as [Interest, number][]) {
    const decayed = v * DECAY;
    if (Math.abs(decayed) > 0.05) weights[k] = decayed;
  }
  const next = (weights[category] ?? 0) + DELTA[signal];
  weights[category] = Math.max(-LIMIT, Math.min(LIMIT, next));
  return { ...profile, weights, events: profile.events + 1, updatedAt: new Date().toISOString() };
}

/** Block or unblock a catalog stop for future suggestions. */
export function withBlocked(profile: TasteProfile, key: string, blocked: boolean): TasteProfile {
  if (!BLOCK_KEY.test(key)) return profile;
  const rest = (profile.blocked ?? []).filter((k) => k !== key);
  const next = blocked ? [...rest, key].slice(-MAX_BLOCKED) : rest;
  return { ...profile, blocked: next.length ? next : undefined, updatedAt: new Date().toISOString() };
}

export const isBlocked = (profile: TasteProfile | undefined, key: string) => Boolean(profile?.blocked?.includes(key));

/** Score adjustment for an experience, scaled by confidence (a handful of signals shouldn't dominate). */
export function tasteBonus(profile: TasteProfile | undefined, cats: Interest[]): number {
  if (!profile || profile.events === 0) return 0;
  const confidence = Math.min(1, profile.events / 8);
  const raw = cats.reduce((s, c) => s + (profile.weights[c] ?? 0), 0) * 0.6;
  return Math.max(-3, Math.min(3, raw)) * confidence;
}

/** Interests the traveller reliably gravitates to, strongest first. */
export function topInterests(profile: TasteProfile | undefined, n = 3): Interest[] {
  if (!profile) return [];
  return (Object.entries(profile.weights) as [Interest, number][])
    .filter(([, w]) => w >= 0.8)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

export function parseTaste(value: unknown): TasteProfile | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Partial<TasteProfile>;
  if (!v.weights || typeof v.weights !== "object") return undefined;
  const weights: Partial<Record<Interest, number>> = {};
  for (const [k, w] of Object.entries(v.weights)) {
    if (isInterest(k) && typeof w === "number" && Number.isFinite(w)) weights[k] = Math.max(-LIMIT, Math.min(LIMIT, w));
  }
  const blocked = Array.isArray(v.blocked) ? [...new Set(v.blocked.filter((k): k is string => typeof k === "string" && BLOCK_KEY.test(k)))].slice(-MAX_BLOCKED) : [];
  return {
    weights,
    events: typeof v.events === "number" && v.events >= 0 ? Math.floor(v.events) : 0,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : new Date().toISOString(),
    ...(blocked.length ? { blocked } : {}),
  };
}

/** Merge two profiles (e.g. an anonymous browser profile into an account), weighted by how many signals each holds. */
export function mergeTaste(a: TasteProfile, b: TasteProfile): TasteProfile {
  const total = a.events + b.events;
  const blocked = [...new Set([...(a.blocked ?? []), ...(b.blocked ?? [])])].slice(-MAX_BLOCKED);
  if (!total) return blocked.length ? { ...emptyTaste(), blocked } : emptyTaste();
  const weights: Partial<Record<Interest, number>> = {};
  for (const k of INTERESTS) {
    const w = ((a.weights[k] ?? 0) * a.events + (b.weights[k] ?? 0) * b.events) / total;
    if (Math.abs(w) > 0.05) weights[k] = w;
  }
  return { weights, events: total, updatedAt: a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt, ...(blocked.length ? { blocked } : {}) };
}
