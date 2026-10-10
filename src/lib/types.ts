import type { Currency, FxSnapshot } from "./currency.ts";
import type { CityFood } from "./food.ts";

export const INTERESTS = [
  "culture",
  "food",
  "nature",
  "history",
  "art",
  "nightlife",
  "shopping",
  "adventure",
  "relaxation",
  "family",
] as const;
export type Interest = (typeof INTERESTS)[number];

export const PACES = ["relaxed", "balanced", "packed"] as const;
export type Pace = (typeof PACES)[number];

export const BUDGET_TIERS = ["shoestring", "comfort", "luxury"] as const;
export type BudgetTier = (typeof BUDGET_TIERS)[number];

export const STAY_TYPES = ["hotel", "apartment", "boutique", "hostel", "resort"] as const;
export type StayType = (typeof STAY_TYPES)[number];

export type Slot = "morning" | "afternoon" | "evening";
export type Climate = "temperate" | "mediterranean" | "tropical" | "cold" | "desert" | "subtropical";

/** What the traveller tells Giro. */
export interface TripRequest {
  /** One or more cities, in travel order. Simple mode uses exactly one. */
  destinations: string[];
  /** Departure city or airport code, e.g. "New York" or "JFK". */
  origin: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  adults: number;
  children: number;
  /** Each child's age (0–17), in the same order as entered. Optional: older trips only have a count. */
  childAges?: number[];
  budgetTier: BudgetTier;
  /** Display currency; defaults to CAD. */
  currency?: Currency;
  /** Optional hard budget for the whole party, in `currency`. */
  totalBudget?: number;
  pace: Pace;
  interests: Interest[];
  stayType: StayType;
  mustSee?: string;
  avoid?: string;
  notes?: string;
  /** Ask Claude to curate the trip (falls back to the built-in engine if unavailable). */
  useAI?: boolean;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  category: Interest | "transit" | "free";
  slot: Slot;
  durationHrs: number;
  /** Estimated cost per adult, USD (converted for display). */
  estCost: number;
  area?: string;
  tip?: string;
  /** Worth pre-booking a ticket / tour. */
  bookable?: boolean;
  booked?: boolean;
  /** Catalog key, used for swapping suggestions. */
  ref?: string;
  /** Start time pinned by the traveller ("HH:MM"); otherwise the schedule engine picks one. */
  start?: string;
  /** Map position, when known (from Wikipedia or geocoding). */
  place?: { lat: number; lon: number };
}

/** A flight the traveller has booked. Times are local wall-clock times at each airport. */
export interface Flight {
  id: string;
  kind: "outbound" | "return" | "between";
  airline?: string;
  flightNumber?: string;
  from: string;
  to: string;
  departDate: string; // YYYY-MM-DD
  departTime: string; // HH:MM
  arriveDate: string;
  arriveTime: string;
  confirmation?: string;
}

/** Where the traveller is actually staying for a leg. */
export interface StayBooking {
  name: string;
  address?: string;
  checkInTime?: string; // HH:MM
  checkOutTime?: string;
  confirmation?: string;
  url?: string;
  lat?: number;
  lon?: number;
}

/** An idea waiting outside the schedule: moved out by a flight change, or saved for later. */
export interface ParkedIdea extends Activity {
  city: string;
  reason?: string;
}

export interface Day {
  index: number;
  date: string; // YYYY-MM-DD
  city: string;
  theme: string;
  activities: Activity[];
  eat?: string;
}

export interface Stay {
  city: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  area: string;
  why: string;
  booking?: StayBooking;
}

export interface BudgetBreakdown {
  flights: number;
  lodging: number;
  food: number;
  activities: number;
  localTransport: number;
  total: number;
  perPerson: number;
}

export interface Trip {
  id: string;
  createdAt: string;
  request: TripRequest;
  title: string;
  summary: string;
  days: Day[];
  stays: Stay[];
  /** All amounts in USD; display with `fx`. */
  budget: BudgetBreakdown;
  /** Exchange rate snapshot taken when the trip was planned. */
  fx: FxSnapshot;
  packing: string[];
  tips: string[];
  source: "giro" | "ai";
  /** Gradient used for the trip cover. */
  palette: [string, string];
  /** Packing-list items the traveller has ticked off. */
  packed?: string[];
  flights?: Flight[];
  parked?: ParkedIdea[];
  /** Giro AI's dishes and restaurants for cities outside the curated catalog. */
  food?: Omit<CityFood, "source">[];
}
