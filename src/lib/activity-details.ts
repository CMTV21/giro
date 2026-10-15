import { DETAILS } from "../data/activity-details/index.ts";
import { findDestination } from "./destinations.ts";
import type { Activity } from "./types.ts";

/**
 * Written details for catalog activities, shown in the details panel. Kept to things that rarely
 * change; live facts (hours, rating, address) come from Google, prices are always "check before
 * you go".
 */
export interface ActivityDetails {
  /** 2–4 sentences: what it is and why it's worth the time. */
  about: string;
  /** When to go: time of day, day of week, season, how to beat crowds. */
  bestTime: string;
  /** Tickets and booking: free or paid, roughly how much, book ahead or not. */
  tickets: string;
  /** Accessibility: stairs, walking, step-free access, suitability for strollers. */
  access?: string;
}

/** Details for a stop that came from the catalog (by its city and catalog key). */
export function detailsFor(a: Pick<Activity, "ref">, city: string): ActivityDetails | undefined {
  if (!a.ref) return undefined;
  const slug = findDestination(city)?.slug;
  return slug ? DETAILS[slug]?.[a.ref] : undefined;
}
