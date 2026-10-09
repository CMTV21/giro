import { curateTrip } from "./curate.ts";
import { addDays, monthOf } from "./dates.ts";
import type { FxSnapshot } from "./currency.ts";
import { DESTINATIONS, type Destination } from "./destinations.ts";
import type { TasteProfile } from "./taste.ts";
import type { BudgetBreakdown, BudgetTier, Interest } from "./types.ts";

/** Budget-first search: "Where can we go for C$4,000 in March?" */

export interface DiscoverQuery {
  /** Total for the whole party, in `fx.currency`. */
  budget: number;
  fx: FxSnapshot;
  origin: string;
  startDate: string;
  nights: number;
  adults: number;
  children: number;
  interests: Interest[];
  taste?: TasteProfile;
}

export interface DiscoverResult {
  destination: Destination;
  tier: BudgetTier;
  /** Estimated total in the query currency. */
  total: number;
  budget: BudgetBreakdown;
  inSeason: boolean;
  interestMatches: number;
  /** Positive = under budget. */
  headroom: number;
  score: number;
}

const TIERS: BudgetTier[] = ["luxury", "comfort", "shoestring"];
const TIER_BONUS: Record<BudgetTier, number> = { luxury: 2, comfort: 1, shoestring: 0 };

export function discover(q: DiscoverQuery, catalog: Destination[] = DESTINATIONS): { fits: DiscoverResult[]; stretch: DiscoverResult[] } {
  const endDate = addDays(q.startDate, Math.max(1, Math.min(29, q.nights)));
  const month = monthOf(q.startDate);
  const fits: DiscoverResult[] = [];
  const stretch: DiscoverResult[] = [];

  for (const d of catalog) {
    // Don't suggest the city they're flying from.
    if (q.origin && d.name.toLowerCase() === q.origin.trim().toLowerCase()) continue;
    const interestMatches = d.activities.filter((a) => a.cats.some((c) => q.interests.includes(c))).length;
    const inSeason = d.bestMonths.includes(month);
    let best: DiscoverResult | undefined;
    let cheapest: DiscoverResult | undefined;
    // Pick the most comfortable tier that still fits the budget.
    for (const tier of TIERS) {
      const trip = curateTrip(
        { destinations: [d.name], origin: q.origin, startDate: q.startDate, endDate, adults: q.adults, children: q.children, budgetTier: tier, pace: "balanced", interests: q.interests, stayType: tier === "shoestring" ? "apartment" : "hotel", currency: q.fx.currency },
        { fx: q.fx, taste: q.taste },
      );
      const total = trip.budget.total * q.fx.rate;
      const result: DiscoverResult = {
        destination: d,
        tier,
        total,
        budget: trip.budget,
        inSeason,
        interestMatches,
        headroom: q.budget - total,
        score: (q.interests.length ? interestMatches : 4) + (inSeason ? 4 : 0) + TIER_BONUS[tier] * 1.5,
      };
      cheapest = result;
      if (total <= q.budget) {
        best = result;
        break;
      }
    }
    if (best) fits.push(best);
    else if (cheapest && cheapest.total <= q.budget * 1.15) stretch.push(cheapest);
  }
  fits.sort((a, b) => b.score - a.score || b.headroom - a.headroom);
  stretch.sort((a, b) => a.total - b.total);
  return { fits, stretch: stretch.slice(0, 4) };
}
