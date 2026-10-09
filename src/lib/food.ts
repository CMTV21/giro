import { FOOD } from "../data/food.ts";
import { findDestination, normalizeCity } from "./destinations.ts";
import type { Activity, Slot, Trip } from "./types.ts";

/** Must-try dishes and restaurants for each city on a trip. */

export type Meal = "breakfast" | "lunch" | "dinner";
export type Price = 1 | 2 | 3 | 4;

export interface Dish {
  name: string;
  what: string;
  /** Wikipedia article title when it differs from the display name (for the photo). */
  wiki?: string;
}

export interface Restaurant {
  name: string;
  area: string;
  /** Cuisine or format, e.g. "Seafood beer hall". */
  kind: string;
  price: Price;
  /** The meal it's best for. */
  meal: Meal;
  why: string;
  /** Worth reserving ahead. */
  book?: boolean;
}

export interface CityFood {
  city: string;
  dishes: Dish[];
  restaurants: Restaurant[];
  /** "giro" = curated by Giro; "ai" = suggested by Giro AI for this trip. */
  source: "giro" | "ai";
}

/** Rough spend per adult (USD) by price level, for the budget and the cost line. */
export const PRICE_USD: Record<Price, number> = { 1: 15, 2: 35, 3: 70, 4: 160 };

const slugify = (s: string) => normalizeCity(s).replace(/ /g, "-").slice(0, 60);
export const restaurantRef = (city: string, r: Pick<Restaurant, "name">) => `food:${slugify(city)}:${slugify(r.name)}`;

export function foodFor(trip: Pick<Trip, "food">, city: string): CityFood {
  const dest = findDestination(city);
  const curated = dest ? FOOD[dest.slug] : undefined;
  if (curated) return { city, ...curated, source: "giro" };
  const ai = trip.food?.find((f) => normalizeCity(f.city) === normalizeCity(city));
  return ai ? { ...ai, city, source: "ai" } : { city, dishes: [], restaurants: [], source: "giro" };
}

const MEAL_SLOT: Record<Meal, Slot> = { breakfast: "morning", lunch: "afternoon", dinner: "evening" };
const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

/** A restaurant as a plan stop. The meal word in the description tells the scheduler not to add another. */
export function restaurantToActivity(r: Restaurant, city: string, id: string): Activity {
  const hrs = r.meal === "breakfast" ? 1 : r.meal === "lunch" ? 1.25 : r.price === 4 ? 2.5 : 1.5;
  return {
    id,
    title: r.name,
    description: `${MEAL_LABEL[r.meal]} · ${r.kind}. ${r.why}`,
    category: "food",
    slot: MEAL_SLOT[r.meal],
    durationHrs: hrs,
    estCost: PRICE_USD[r.price],
    area: r.area,
    tip: r.book ? "Reserve ahead." : undefined,
    bookable: false,
    ref: restaurantRef(city, r),
  };
}

export const priceLabel = (p: Price) => "$".repeat(p);
