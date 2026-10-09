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
  budgetTier: BudgetTier;
  /** Optional hard budget for the whole party, in USD. */
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
  /** Estimated cost per adult, USD. */
  estCost: number;
  area?: string;
  tip?: string;
  /** Worth pre-booking a ticket / tour. */
  bookable?: boolean;
  booked?: boolean;
  /** Catalog key, used for swapping suggestions. */
  ref?: string;
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
  budget: BudgetBreakdown;
  packing: string[];
  tips: string[];
  source: "giro" | "ai";
  /** Gradient used for the trip cover. */
  palette: [string, string];
  /** Packing-list items the traveller has ticked off. */
  packed?: string[];
}
