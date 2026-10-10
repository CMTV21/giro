import { curateTrip } from "./curate.ts";
import { addDays } from "./dates.ts";
import { DESTINATIONS, type Destination } from "./destinations.ts";
import type { FxSnapshot } from "./currency.ts";
import type { Trip } from "./types.ts";

/**
 * Public trip guides ("4 days in Lisbon"): Giro's own curated plan for each catalog city at a few
 * lengths, built by the same engine travellers use, so "Plan this trip" gives them the same days.
 */

export const GUIDE_LENGTHS = [3, 5, 7] as const;
export type GuideLength = (typeof GUIDE_LENGTHS)[number];

/** Dates aren't shown on guides; a fixed reference keeps builds identical (first best month, next year). */
const REF_YEAR = 2027;

export const guideParam = (days: number) => `${days}-days`;
export const guidePath = (slug: string, days: number) => `/guides/${slug}/${guideParam(days)}`;

export function parseGuideParam(param: string): GuideLength | undefined {
  const n = Number(/^(\d+)-days$/.exec(param)?.[1]);
  return (GUIDE_LENGTHS as readonly number[]).includes(n) ? (n as GuideLength) : undefined;
}

export const guideDestination = (slug: string): Destination | undefined => DESTINATIONS.find((d) => d.slug === slug);

export function guideStart(dest: Destination): string {
  const month = dest.bestMonths[0] ?? 5;
  return `${REF_YEAR}-${String(month).padStart(2, "0")}-08`;
}

/** The planner settings a guide uses; "Plan this trip" sends the same ones. */
export const GUIDE_PLAN = { adults: 2, children: 0, budgetTier: "comfort", pace: "balanced", stayType: "hotel" } as const;

export function buildGuide(dest: Destination, days: GuideLength, fx?: FxSnapshot): Trip {
  const start = guideStart(dest);
  return curateTrip(
    {
      destinations: [dest.name],
      origin: "",
      startDate: start,
      endDate: addDays(start, days - 1),
      ...GUIDE_PLAN,
      // The planner's defaults, so "Plan this trip" produces the same days.
      interests: ["culture", "food"],
      currency: "CAD",
    },
    { fx },
  );
}

/** A guide is worth publishing only if every day between arrival and departure has real stops. */
export function guideIsFull(trip: Trip): boolean {
  return trip.days.slice(1, -1).every((d) => d.activities.some((a) => a.category !== "transit" && a.category !== "free"));
}

const lengthsCache = new Map<string, GuideLength[]>();

/** Published lengths for a city: longer guides appear once the catalog has enough to fill them. */
export function guideLengths(dest: Destination): GuideLength[] {
  let lengths = lengthsCache.get(dest.slug);
  if (!lengths) {
    lengths = GUIDE_LENGTHS.filter((n) => guideIsFull(buildGuide(dest, n)));
    lengthsCache.set(dest.slug, lengths);
  }
  return lengths;
}

export function allGuides(): { slug: string; days: GuideLength }[] {
  return DESTINATIONS.flatMap((d) => guideLengths(d).map((days) => ({ slug: d.slug, days })));
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "April to June, September and October" from [4, 5, 6, 9, 10]; seasons may wrap ("December to February"). */
export function monthsLabel(months: number[]): string {
  const set = new Set(months.filter((m) => m >= 1 && m <= 12));
  if (set.size === 12) return "all year";
  const prev = (m: number) => (m === 1 ? 12 : m - 1);
  const next = (m: number) => (m === 12 ? 1 : m + 1);
  const runs: number[][] = [];
  for (const start of [...set].sort((a, b) => a - b)) {
    if (set.has(prev(start))) continue;
    const run = [start];
    while (set.has(next(run.at(-1)!))) run.push(next(run.at(-1)!));
    runs.push(run);
  }
  const items = runs.flatMap((r) => (r.length >= 3 ? [`${MONTHS[r[0] - 1]} to ${MONTHS[r.at(-1)! - 1]}`] : r.map((m) => MONTHS[m - 1])));
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0] ?? "";
}

/** Rough daily cost per person (USD) at each tier: a shared double room, meals and local transport. */
export function dailyPerPerson(dest: Destination) {
  return (["shoestring", "comfort", "luxury"] as const).map((tier) => {
    const d = dest.daily[tier];
    return { tier, usd: Math.round(d.lodging / 2 + d.food + d.transport) };
  });
}
