import {
  BedDouble,
  Footprints,
  Landmark,
  Moon,
  Mountain,
  Palette,
  Route,
  ScrollText,
  ShoppingBag,
  Trees,
  Users,
  UtensilsCrossed,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { Activity, BudgetTier, Interest, Pace, StayType } from "@/lib/types";

export const INTEREST_META: Record<Interest, { label: string; icon: LucideIcon }> = {
  culture: { label: "Culture", icon: Landmark },
  food: { label: "Food & drink", icon: UtensilsCrossed },
  nature: { label: "Nature", icon: Trees },
  history: { label: "History", icon: ScrollText },
  art: { label: "Art & design", icon: Palette },
  nightlife: { label: "Nightlife", icon: Moon },
  shopping: { label: "Shopping", icon: ShoppingBag },
  adventure: { label: "Adventure", icon: Mountain },
  relaxation: { label: "Relaxation", icon: Waves },
  family: { label: "Family", icon: Users },
};

const TONES: Record<Interest, string> = {
  culture: "bg-indigo-50 text-indigo-700",
  food: "bg-orange-50 text-orange-700",
  nature: "bg-emerald-50 text-emerald-700",
  history: "bg-amber-50 text-amber-800",
  art: "bg-fuchsia-50 text-fuchsia-700",
  nightlife: "bg-violet-50 text-violet-700",
  shopping: "bg-rose-50 text-rose-700",
  adventure: "bg-lime-50 text-lime-800",
  relaxation: "bg-sky-50 text-sky-700",
  family: "bg-teal-50 text-teal-700",
};

type CategoryMeta = { label: string; icon: LucideIcon; tone: string };

export const CATEGORY_META: Record<Activity["category"], CategoryMeta> = {
  ...(Object.fromEntries(
    (Object.keys(INTEREST_META) as Interest[]).map((k) => [k, { ...INTEREST_META[k], tone: TONES[k] }]),
  ) as Record<Interest, CategoryMeta>),
  transit: { label: "Travel", icon: Route, tone: "bg-slate-100 text-slate-700" },
  free: { label: "Free time", icon: Footprints, tone: "bg-sand text-ink-soft" },
};

export const PACE_META: Record<Pace, { label: string; hint: string }> = {
  relaxed: { label: "Relaxed", hint: "2 things a day, long lunches" },
  balanced: { label: "Balanced", hint: "3 things a day, evenings out" },
  packed: { label: "Packed", hint: "See it all, sleep later" },
};

export const BUDGET_META: Record<BudgetTier, { label: string; hint: string; symbol: string }> = {
  shoestring: { label: "Shoestring", hint: "Smart & scrappy", symbol: "$" },
  comfort: { label: "Comfort", hint: "Treat yourself, sensibly", symbol: "$$" },
  luxury: { label: "Luxury", hint: "The very best", symbol: "$$$" },
};

export const STAY_META: Record<StayType, { label: string; icon: LucideIcon }> = {
  hotel: { label: "Hotel", icon: BedDouble },
  apartment: { label: "Apartment / Airbnb", icon: BedDouble },
  boutique: { label: "Boutique", icon: BedDouble },
  hostel: { label: "Hostel", icon: BedDouble },
  resort: { label: "Resort", icon: BedDouble },
};
