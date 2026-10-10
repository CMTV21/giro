/**
 * Who's travelling. Children's ages are optional (older trips only stored a count), so every
 * consumer goes through `childAges`, which fills unknown ages with a typical school age.
 */

export const DEFAULT_CHILD_AGE = 8;
export const MAX_CHILD_AGE = 17;

export interface PartyLike {
  children: number;
  childAges?: number[];
}

const cleanAge = (a: unknown): number | undefined =>
  typeof a === "number" && Number.isFinite(a) ? Math.min(MAX_CHILD_AGE, Math.max(0, Math.round(a))) : undefined;

/** Ages clamped to 0–17 and trimmed to the child count; undefined when none were given. */
export function normalizeChildAges(children: number, ages?: unknown[]): number[] | undefined {
  if (!children || !Array.isArray(ages)) return undefined;
  const clean = ages.slice(0, children).map(cleanAge).filter((a): a is number => a !== undefined);
  return clean.length ? clean : undefined;
}

/** One age per child, using the default for any that weren't given. */
export function childAges(p: PartyLike): number[] {
  const known = normalizeChildAges(p.children, p.childAges) ?? [];
  return Array.from({ length: Math.max(0, p.children) }, (_, i) => known[i] ?? DEFAULT_CHILD_AGE);
}

/** True when ages were actually entered (not defaulted), so wording can be specific. */
export const agesKnown = (p: PartyLike) => (normalizeChildAges(p.children, p.childAges)?.length ?? 0) === p.children && p.children > 0;

export interface PartyMix {
  /** Under 2: lap infants on most airlines, free at most sights. */
  infants: number;
  /** 2–12. */
  kids: number;
  /** 13–17: adult-like for most activities, still minors. */
  teens: number;
  youngest?: number;
}

export function partyMix(p: PartyLike): PartyMix {
  const ages = childAges(p);
  return {
    infants: ages.filter((a) => a < 2).length,
    kids: ages.filter((a) => a >= 2 && a <= 12).length,
    teens: ages.filter((a) => a >= 13).length,
    youngest: ages.length ? Math.min(...ages) : undefined,
  };
}

/** "2 adults and 2 children (4, 9)" — ages only when the traveller entered them. */
export function describeParty(p: PartyLike & { adults: number }): string {
  const adults = `${p.adults} adult${p.adults === 1 ? "" : "s"}`;
  if (!p.children) return adults;
  const kids = `${p.children} child${p.children === 1 ? "" : "ren"}`;
  return `${adults} and ${kids}${agesKnown(p) ? ` (${childAges(p).map(ageLabel).join(", ")})` : ""}`;
}

export const ageLabel = (a: number) => (a === 0 ? "under 1" : String(a));
