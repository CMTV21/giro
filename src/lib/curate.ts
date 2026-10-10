import { distanceKm, fareForDistance, findAirport } from "./airports.ts";
import { DEFAULT_CURRENCY, fallbackFx, formatLocal, isCurrency, type FxSnapshot } from "./currency.ts";
import { addDays, monthOf, nightsBetween } from "./dates.ts";
import { DESTINATIONS, findDestination, type CatalogActivity, type Destination } from "./destinations.ts";
import { childAges, describeParty, normalizeChildAges, partyMix } from "./party.ts";
import { tasteBonus, type TasteProfile } from "./taste.ts";
import type { Activity, BudgetBreakdown, BudgetTier, Day, Interest, Pace, Slot, Stay, StayType, Trip, TripRequest } from "./types.ts";

export const MAX_TRIP_DAYS = 30;

const SLOTS_BY_PACE: Record<Pace, Slot[]> = {
  relaxed: ["morning", "afternoon"],
  balanced: ["morning", "afternoon", "evening"],
  packed: ["morning", "afternoon", "afternoon", "evening"],
};

const THEME_BY_CATEGORY: Record<Interest, string> = {
  culture: "Icons & culture",
  food: "A taste of the city",
  nature: "Into the green",
  history: "Layers of history",
  art: "Art & design",
  nightlife: "After dark",
  shopping: "Markets & makers",
  adventure: "Adventure day",
  relaxation: "Slow & easy",
  family: "Family fun",
};

const STAY_MULTIPLIER: Record<StayType, number> = {
  hostel: 0.55,
  apartment: 0.9,
  hotel: 1,
  boutique: 1.15,
  resort: 1.4,
};

const FLIGHT_MULTIPLIER: Record<BudgetTier, number> = { shoestring: 0.85, comfort: 1, luxury: 3.2 };

const PALETTES: [string, string][] = [
  ["#0f766e", "#f59e0b"],
  ["#4338ca", "#ec4899"],
  ["#0369a1", "#22c55e"],
  ["#7c2d12", "#f97316"],
  ["#1e293b", "#38bdf8"],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID().replaceAll("-", "").slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

const titleCase = (s: string) => s.trim().replace(/\s+/g, " ").replace(/\b\p{L}/gu, (ch) => ch.toUpperCase());

/** A reasonable catalog for cities Giro doesn't know yet. Claude curation fills the gap with real places. */
export function genericDestination(rawCity: string): Destination {
  const city = titleCase(rawCity);
  const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const a = (key: string, title: string, description: string, cats: Interest[], slot: CatalogActivity["slot"], hrs: number, cost: number, extra: Partial<CatalogActivity> = {}): CatalogActivity => ({
    key: `${slug}-${key}`,
    title,
    description,
    cats,
    slot,
    hrs,
    cost,
    area: extra.area ?? "City centre",
    ...extra,
  });
  return {
    slug,
    name: city,
    country: "",
    aliases: [],
    airport: city,
    lat: Number.NaN,
    lon: Number.NaN,
    climate: "temperate",
    palette: PALETTES[hash(slug) % PALETTES.length],
    tagline: `Your own way through ${city}.`,
    bestMonths: [],
    areas: {
      shoestring: { name: `Near ${city}'s main station`, why: "Budget-friendly, with transport links in every direction." },
      comfort: { name: `${city} old town / centre`, why: "Walkable to the main sights, cafés and evening life." },
      luxury: { name: `${city}'s most upscale district`, why: "Quieter streets, top hotels and fine dining close by." },
    },
    daily: {
      shoestring: { lodging: 80, food: 35, transport: 8 },
      comfort: { lodging: 180, food: 70, transport: 12 },
      luxury: { lodging: 520, food: 180, transport: 40 },
    },
    flightEst: 800,
    eats: [
      `The dish ${city} is famous for, at a busy local spot`,
      "Lunch at the central food market",
      "Street food from a stall with a queue of locals",
      "A long dinner at a neighbourhood favourite",
    ],
    tips: [
      `Check opening days for ${city}'s museums because many close one day a week.`,
      "Download offline maps and a local transit app before you land.",
    ],
    activities: [
      a("walking-tour", `Old town walking tour of ${city}`, "Get your bearings with a local guide on a tip-based free walking tour.", ["culture", "history"], "morning", 2.5, 15, { bookable: true, kids: true, area: "Old town" }),
      a("museum", `${city}'s top museum`, "Spend the morning at the city's flagship museum.", ["history", "art", "culture"], "morning", 2.5, 20, { kids: true }),
      a("market", "Central food market", "Graze through local produce, snacks and specialities.", ["food"], "any", 1.5, 20, { kids: true, area: "Market district" }),
      a("food-tour", `${city} food tour`, "Small-group tasting tour with a local guide.", ["food"], "afternoon", 3, 80, { bookable: true }),
      a("viewpoint", "Sunset viewpoint", "Golden hour from the best panorama in town.", ["relaxation", "culture"], "evening", 1.5, 0, { kids: true }),
      a("park", "Main city park", "Picnic and people-watching in the city's green heart.", ["nature", "relaxation", "family"], "any", 2, 0, { kids: true, area: "City park" }),
      a("day-trip", `Nature day trip from ${city}`, "Head out to the nearest national park, coast or countryside.", ["nature", "adventure"], "morning", 7, 60, { bookable: true, kids: true, area: "Out of town" }),
      a("cooking", "Cooking class", "Learn the regional classics hands-on.", ["food", "family"], "afternoon", 3, 70, { bookable: true, kids: true }),
      a("nightlife", "Live music and bars", "Explore the city's liveliest nightlife district.", ["nightlife"], "evening", 3, 40, { area: "Nightlife district" }),
      a("shopping", "Markets and independent shops", "Local designers, crafts and vintage finds.", ["shopping", "art"], "afternoon", 2.5, 0),
      a("spa", "Spa or thermal baths", "Recharge with a local wellness ritual.", ["relaxation"], "afternoon", 2, 50, { bookable: true }),
      a("bike", "Guided bike tour", "Cover more ground and see the neighbourhoods.", ["adventure", "culture"], "morning", 3, 40, { bookable: true, kids: true }),
      a("galleries", "Galleries and street art", "Contemporary art spaces and murals.", ["art"], "afternoon", 2, 10, { area: "Arts district" }),
      a("family", "Zoo, aquarium or science centre", "A guaranteed hit with kids.", ["family"], "afternoon", 3, 25, { kids: true, bookable: true }),
      a("landmark", `${city}'s signature landmark`, "The view that's on every postcard, best visited early.", ["culture", "history"], "morning", 2, 15, { kids: true, bookable: true }),
    ],
  };
}

export function resolveDestination(city: string): Destination {
  return findDestination(city) ?? genericDestination(city);
}

export interface Leg {
  city: string;
  destination: Destination;
  nights: number;
  /** Day index (0-based) on which this leg starts. */
  startDay: number;
  checkIn: string;
  checkOut: string;
}

/** Split the trip's nights across the requested cities, in order. */
export function planLegs(req: TripRequest): Leg[] {
  const totalNights = clampNights(req);
  const cities = req.destinations.map((d) => d.trim()).filter(Boolean).slice(0, Math.max(1, totalNights));
  const n = Math.max(1, cities.length);
  const base = Math.floor(totalNights / n);
  let extra = totalNights - base * n;
  let cursor = 0;
  return cities.map((raw) => {
    const destination = resolveDestination(raw);
    const nights = base + (extra-- > 0 ? 1 : 0);
    const leg: Leg = {
      city: destination.name,
      destination,
      nights,
      startDay: cursor,
      checkIn: addDays(req.startDate, cursor),
      checkOut: addDays(req.startDate, cursor + nights),
    };
    cursor += nights;
    return leg;
  });
}

function clampNights(req: TripRequest): number {
  const n = nightsBetween(req.startDate, req.endDate);
  return Math.min(Math.max(1, Number.isFinite(n) ? n : 1), MAX_TRIP_DAYS - 1);
}

export const phrases = (s?: string) =>
  (s ?? "")
    .split(/[,;\n]/)
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length >= 3);

function matchesPhrase(act: CatalogActivity, list: string[]): boolean {
  if (!list.length) return false;
  const hay = `${act.title} ${act.description} ${act.area}`.toLowerCase();
  return list.some((p) => hay.includes(p) || p.split(/\s+/).filter((w) => w.length > 3).every((w) => hay.includes(w)));
}

/** Evening slots only take evening experiences; "any" means any daytime slot (parks and markets close). */
const fitsSlot = (act: CatalogActivity, slot: Slot) => (slot === "evening" ? act.slot === "evening" : act.slot !== "evening");

export interface ScoreContext {
  req: TripRequest;
  must: string[];
  avoid: string[];
  catalogSize: number;
  taste?: TasteProfile;
}

export function scoreActivity(act: CatalogActivity, index: number, ctx: ScoreContext): number {
  const { req } = ctx;
  if (matchesPhrase(act, ctx.avoid)) return -Infinity;
  const mix = req.children > 0 ? partyMix(req) : undefined;
  // Under-12s rule out very long days; any minor rules out bars and clubs.
  const youngKids = mix ? mix.infants + mix.kids > 0 : false;
  if (mix && ((youngKids && act.hrs >= 9) || (!act.kids && act.cats.includes("nightlife")))) return -Infinity;
  let score = 1;
  const overlap = act.cats.filter((c) => req.interests.includes(c)).length;
  score += overlap * 3;
  if (req.interests.length === 0) score += 1;
  if (mix) {
    // Teens can do most adult itineraries, so only nudge; little ones need kid-friendly stops.
    score += youngKids ? (act.kids ? 1.5 : -4) : act.kids ? 0.5 : -0.5;
    if (mix.youngest !== undefined && mix.youngest < 5 && act.hrs >= 6) score -= 2;
  }
  if (req.budgetTier === "shoestring") score += act.cost > 60 ? -3 : act.cost === 0 ? 1 : 0;
  if (req.budgetTier === "luxury" && act.cost >= 60) score += 1.5;
  if (req.pace === "relaxed" && act.hrs >= 6) score -= 1.5;
  if (matchesPhrase(act, ctx.must)) score += 20;
  score += tasteBonus(ctx.taste, act.cats);
  // Catalogs list the iconic experiences first.
  score += ((ctx.catalogSize - index) / ctx.catalogSize) * 1.5;
  return score;
}

interface CityState {
  destination: Destination;
  used: Set<string>;
  dayTrips: number;
  eatIndex: number;
}

export function toActivity(act: CatalogActivity, slot: Slot): Activity {
  return {
    id: newId(),
    title: act.title,
    description: act.description,
    category: act.cats[0],
    slot,
    durationHrs: act.hrs,
    estCost: act.cost,
    area: act.area,
    tip: act.tip,
    bookable: act.bookable,
    ref: act.key,
  };
}

const transit = (title: string, description: string, slot: Slot): Activity => ({
  id: newId(),
  title,
  description,
  category: "transit",
  slot,
  durationHrs: 3,
  estCost: 0,
});

const freeTime = (city: string, slot: Slot, area?: string): Activity => ({
  id: newId(),
  title: slot === "evening" ? "Evening at leisure" : area ? `Free time around ${area}` : `Wander ${city}`,
  description: slot === "evening" ? "Dinner somewhere that catches your eye, then a stroll or an early night." : "Unscheduled time for cafés, rest, or the discovery you didn't plan.",
  category: "free",
  slot,
  durationHrs: 2,
  estCost: 0,
  area,
});

function planDay(state: CityState, slots: Slot[], ctx: ScoreContext, allowDayTrip: boolean): Activity[] {
  const { destination } = state;
  const catalog = destination.activities;
  const candidates = catalog
    .map((act, i) => ({ act, base: scoreActivity(act, i, ctx) }))
    .filter((c) => !state.used.has(c.act.key) && Number.isFinite(c.base));

  const picks: Activity[] = [];
  const remaining = [...slots];
  let anchorArea: string | undefined;

  const take = (act: CatalogActivity, slot: Slot) => {
    state.used.add(act.key);
    picks.push(toActivity(act, slot));
    anchorArea ??= act.area;
  };

  // A full-day excursion replaces the morning and afternoon.
  if (allowDayTrip && remaining.includes("morning") && remaining.includes("afternoon")) {
    const best = candidates.filter((c) => c.act.hrs >= 6).sort((x, y) => y.base - x.base)[0];
    const bestRegular = candidates.filter((c) => c.act.hrs < 6).sort((x, y) => y.base - x.base)[0];
    if (best && best.base >= (bestRegular?.base ?? 0) - 0.5 && best.base > 3) {
      take(best.act, "morning");
      state.dayTrips++;
      for (const s of ["morning", "afternoon"] as Slot[]) {
        const i = remaining.indexOf(s);
        if (i >= 0) remaining.splice(i, 1);
      }
      while (remaining.includes("afternoon")) remaining.splice(remaining.indexOf("afternoon"), 1);
    }
  }

  for (const slot of remaining) {
    let best: { act: CatalogActivity; score: number } | undefined;
    for (const c of candidates) {
      if (state.used.has(c.act.key) || c.act.hrs >= 6 || !fitsSlot(c.act, slot)) continue;
      let score = c.base;
      if (c.act.slot === slot) score += 1.5;
      if (anchorArea && c.act.area === anchorArea) score += 2.5;
      if (!best || score > best.score) best = { act: c.act, score };
    }
    if (best) take(best.act, slot);
    else picks.push(freeTime(destination.name, slot, slot === "evening" ? undefined : anchorArea));
  }

  const order: Record<Slot, number> = { morning: 0, afternoon: 1, evening: 2 };
  return picks.sort((a, b) => order[a.slot] - order[b.slot]);
}

function themeFor(day: Activity[], city: string, kind: "arrival" | "departure" | "transfer" | "full"): string {
  if (kind === "arrival") return `Arrive & settle into ${city}`;
  if (kind === "departure") return `Farewell, ${city}`;
  if (kind === "transfer") return `On to ${city}`;
  const trip = day.find((a) => a.durationHrs >= 6);
  if (trip) return `Day trip: ${trip.title}`;
  const counts = new Map<Interest, number>();
  for (const a of day) if (a.category !== "transit" && a.category !== "free") counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  return top ? THEME_BY_CATEGORY[top] : `Explore ${city}`;
}

export function buildDays(req: TripRequest, legs: Leg[], taste?: TasteProfile): Day[] {
  const ctxBase = { req, must: phrases(req.mustSee), avoid: phrases(req.avoid), taste };
  const states = new Map<string, CityState>();
  const totalNights = legs.reduce((s, l) => s + l.nights, 0);
  const paceSlots = SLOTS_BY_PACE[req.pace] ?? SLOTS_BY_PACE.balanced;
  const days: Day[] = [];

  for (let dayIndex = 0; dayIndex <= totalNights; dayIndex++) {
    const legIndex = Math.max(0, legs.findLastIndex((l) => l.startDay <= dayIndex && dayIndex < l.startDay + l.nights));
    const isLast = dayIndex === totalNights;
    const leg = isLast ? legs[legs.length - 1] : legs[legIndex];
    const state = states.get(leg.destination.slug) ?? { destination: leg.destination, used: new Set(), dayTrips: 0, eatIndex: 0 };
    states.set(leg.destination.slug, state);
    const ctx: ScoreContext = { ...ctxBase, catalogSize: leg.destination.activities.length };

    const isFirst = dayIndex === 0;
    const isTransfer = !isFirst && !isLast && leg.startDay === dayIndex;
    const kind = isFirst ? "arrival" : isLast ? "departure" : isTransfer ? "transfer" : "full";

    let activities: Activity[];
    if (kind === "arrival") {
      const slots: Slot[] = paceSlots.length > 2 ? ["afternoon", "evening"] : ["evening"];
      activities = [
        transit(`Arrive in ${leg.city}`, `Check in at your stay in ${leg.destination.areas[req.budgetTier].name}.`, "morning"),
        ...planDay(state, slots, ctx, false),
      ];
    } else if (kind === "departure") {
      activities = [
        ...(paceSlots.length > 2 ? planDay(state, ["morning"], ctx, false) : []),
        transit(`Depart ${leg.city}`, "Check out and head to the airport or station, allowing plenty of time.", "afternoon"),
      ];
    } else if (kind === "transfer") {
      const prev = legs[legIndex - 1];
      activities = [
        transit(`${prev.city} → ${leg.city}`, `Travel to ${leg.city} by train or flight, then check in.`, "morning"),
        ...planDay(state, paceSlots.length > 2 ? ["afternoon", "evening"] : ["evening"], ctx, false),
      ];
    } else {
      const fullDays = Math.max(1, leg.nights - 1);
      const allowDayTrip = state.dayTrips < Math.max(1, Math.floor(fullDays / 3));
      activities = planDay(state, paceSlots, ctx, allowDayTrip);
    }

    const eats = leg.destination.eats;
    days.push({
      index: dayIndex,
      date: addDays(req.startDate, dayIndex),
      city: leg.city,
      theme: themeFor(activities, leg.city, kind),
      activities,
      eat: eats.length ? eats[state.eatIndex++ % eats.length] : undefined,
    });
  }
  return days;
}

const round10 = (n: number) => Math.round(n / 10) * 10;

/** Where an origin string is on the map: a known airport or a catalog city. */
export function locate(place: string): { lat: number; lon: number } | undefined {
  const airport = findAirport(place);
  if (airport) return airport;
  const dest = findDestination(place);
  return dest && Number.isFinite(dest.lat) ? dest : undefined;
}

/**
 * Indicative economy return fare per adult (USD). Uses great-circle distance from the origin
 * (outbound to the first city, home from the last) when both ends are known, otherwise the
 * catalog's typical fare.
 */
export function returnFareUSD(origin: string, legs: Leg[]): number {
  const from = locate(origin);
  const first = legs[0].destination;
  const last = legs[legs.length - 1].destination;
  const known = (d: Destination) => Number.isFinite(d.lat) && Number.isFinite(d.lon);
  if (from && known(first) && known(last)) {
    const out = fareForDistance(distanceKm(from, first));
    const back = fareForDistance(distanceKm(last, from));
    return (out + back) / 2;
  }
  return first.flightEst;
}

export function estimateBudget(req: TripRequest, legs: Leg[], days: Day[]): BudgetBreakdown {
  const tier = req.budgetTier;
  const adults = Math.max(1, req.adults);
  const ages = childAges(req);
  const people = adults + ages.length;
  // Each child as a fraction of an adult. The default age (8) gives the long-standing flat shares.
  const share = (f: (age: number) => number) => adults + ages.reduce((s, a) => s + f(a), 0);
  const rooms = req.stayType === "apartment" || req.stayType === "resort" ? Math.max(1, Math.ceil(people / 4)) : Math.max(1, Math.ceil(adults / 2));
  const legOf = (city: string) => legs.find((l) => l.city === city) ?? legs[0];

  const lodging = legs.reduce((s, l) => s + l.nights * l.destination.daily[tier].lodging * rooms * STAY_MULTIPLIER[req.stayType], 0);
  const food = days.reduce((s, d) => s + legOf(d.city).destination.daily[tier].food * share((a) => (a < 2 ? 0.2 : a <= 12 ? 0.6 : 0.9)), 0);
  const transfers = Math.max(0, legs.length - 1) * 80 * people;
  const localTransport = days.reduce((s, d) => s + legOf(d.city).destination.daily[tier].transport * share((a) => (a < 4 ? 0 : a <= 12 ? 0.5 : 0.8)), 0) + transfers;
  const activities = days.reduce((s, d) => s + d.activities.reduce((t, a) => t + a.estCost, 0), 0) * share((a) => (a < 4 ? 0 : a <= 12 ? 0.5 : 0.8));
  const fare = req.origin.trim() ? returnFareUSD(req.origin, legs) : 0;
  const flights = fare * FLIGHT_MULTIPLIER[tier] * share((a) => (a < 2 ? 0.1 : a <= 11 ? 0.75 : 1));

  const out = {
    flights: round10(flights),
    lodging: round10(lodging),
    food: round10(food),
    activities: round10(activities),
    localTransport: round10(localTransport),
  };
  const total = out.flights + out.lodging + out.food + out.activities + out.localTransport;
  return { ...out, total, perPerson: round10(total / people) };
}

export function packingList(req: TripRequest, legs: Leg[]): string[] {
  const items = new Set<string>([
    "Passport / ID and travel insurance details",
    "Phone, charger and a universal adapter",
    "Comfortable walking shoes",
    "Reusable water bottle",
    "Any medication, plus copies of prescriptions",
    "A light day bag",
  ]);
  const month = monthOf(req.startDate);
  const southern = (d: Destination) => Number.isFinite(d.lat) && d.lat < 0;
  for (const { destination: d } of legs) {
    const summer = southern(d) ? [12, 1, 2].includes(month) : [6, 7, 8].includes(month);
    const winter = southern(d) ? [6, 7, 8].includes(month) : [12, 1, 2].includes(month);
    switch (d.climate) {
      case "tropical":
        ["Breathable, quick-dry clothing", "Reef-safe sunscreen", "Insect repellent", "Light rain jacket", "Sarong or cover-up for temples"].forEach((i) => items.add(i));
        break;
      case "desert":
        ["Sun hat and sunglasses", "Layers for cool desert nights", "Scarf for sun and modest dress", "High-SPF sunscreen"].forEach((i) => items.add(i));
        break;
      case "cold":
        ["Waterproof shell jacket", "Thermal base layers", "Warm hat and gloves", "Swimsuit for geothermal pools", "Waterproof hiking boots"].forEach((i) => items.add(i));
        break;
      default:
        if (summer) ["Sunscreen and sunglasses", "Light breathable layers"].forEach((i) => items.add(i));
        else if (winter) ["Warm coat", "Scarf and gloves", "Compact umbrella"].forEach((i) => items.add(i));
        else ["Packable layers", "Compact umbrella"].forEach((i) => items.add(i));
    }
  }
  if (req.children > 0) {
    ["Snacks and entertainment for transit", "Kids' sun protection", "Child-friendly first-aid kit", "Passports for each child, plus a consent letter if one parent travels alone"].forEach((i) => items.add(i));
    const { youngest } = partyMix(req);
    if (youngest !== undefined && youngest < 3) ["Travel stroller or baby carrier", "Diapers, wipes and a change mat"].forEach((i) => items.add(i));
  }
  if (req.interests.includes("adventure") || req.interests.includes("nature")) items.add("Daypack and trail shoes");
  if (req.interests.includes("nightlife") || req.budgetTier === "luxury") items.add("One smart outfit for dinners out");
  if (req.interests.includes("relaxation")) items.add("Swimsuit");
  return [...items];
}

function buildTips(req: TripRequest, legs: Leg[], days: Day[], budget: BudgetBreakdown, fx: FxSnapshot): string[] {
  const tips: string[] = [];
  for (const leg of legs) tips.push(...leg.destination.tips.slice(0, 2));
  const month = monthOf(req.startDate);
  for (const leg of legs) {
    const best = leg.destination.bestMonths;
    if (best.length && !best.includes(month)) {
      tips.push(`${new Date(Date.UTC(2000, month - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" })} is outside ${leg.city}'s peak season, so expect different weather but fewer crowds and lower prices.`);
    }
  }
  const open = days.flatMap((d) => d.activities).filter((a) => a.category === "free").length;
  if (open >= 2) tips.push(`We've left ${open} open slots. Keep them for spontaneity, add your own stops, or switch on Giro AI to fill them with deeper local picks.`);
  const bookable = days.flatMap((d) => d.activities).filter((a) => a.bookable).length;
  if (bookable) tips.push(`${bookable} activities on this itinerary are worth pre-booking. Use the Book tab to lock in tickets.`);
  const totalLocal = budget.total * fx.rate;
  if (req.totalBudget && totalLocal > req.totalBudget) {
    tips.push(`This plan runs about ${formatLocal(totalLocal - req.totalBudget, fx.currency)} over your budget. Try an apartment instead of a hotel, a relaxed pace, or shoulder-season dates.`);
  }
  const must = phrases(req.mustSee);
  if (must.length) {
    const titles = days.flatMap((d) => d.activities.map((a) => `${a.title} ${a.description}`.toLowerCase()));
    const missing = must.filter((m) => !titles.some((t) => t.includes(m)));
    if (missing.length) tips.push(`Couldn't place "${missing.join('", "')}" automatically. Add it as a custom stop, or switch on Giro AI for a deeper search.`);
  }
  return [...new Set(tips)];
}

export function tripTitle(legs: Leg[], days: number): string {
  if (legs.length === 1) return `${days} days in ${legs[0].city}`;
  if (legs.length === 2) return `${legs[0].city} & ${legs[1].city}`;
  return `${legs.slice(0, -1).map((l) => l.city).join(", ")} & ${legs[legs.length - 1].city}`;
}

/** Clean and bound user input before planning. */
export function normalizeRequest(input: TripRequest): TripRequest {
  const destinations = input.destinations.map((d) => d.trim()).filter(Boolean).slice(0, 6);
  const children = Math.min(10, Math.max(0, Math.round(input.children || 0)));
  return {
    ...input,
    destinations: destinations.length ? destinations : ["Lisbon"],
    origin: (input.origin ?? "").trim(),
    adults: Math.min(16, Math.max(1, Math.round(input.adults || 1))),
    children,
    childAges: normalizeChildAges(children, input.childAges),
    interests: [...new Set(input.interests ?? [])],
    currency: isCurrency(input.currency) ? input.currency : DEFAULT_CURRENCY,
    totalBudget: input.totalBudget && input.totalBudget > 0 ? Math.round(input.totalBudget) : undefined,
  };
}

export interface CurateOptions {
  /** Exchange-rate snapshot for the request's currency; falls back to built-in rates. */
  fx?: FxSnapshot;
  /** Learned preferences that nudge which experiences make the cut. */
  taste?: TasteProfile;
}

export function resolveFx(req: TripRequest, fx?: FxSnapshot): FxSnapshot {
  const currency = req.currency ?? DEFAULT_CURRENCY;
  return fx && fx.currency === currency && fx.rate > 0 ? fx : fallbackFx(currency);
}

/** Giro's built-in curation engine: deterministic, instant, works offline. */
export function curateTrip(input: TripRequest, opts: CurateOptions = {}): Trip {
  const req = normalizeRequest(input);
  const fx = resolveFx(req, opts.fx);
  const legs = planLegs(req);
  const days = buildDays(req, legs, opts.taste);
  const budget = estimateBudget(req, legs, days);
  const stays: Stay[] = legs.map((l) => ({
    city: l.city,
    checkIn: l.checkIn,
    checkOut: l.checkOut,
    nights: l.nights,
    area: l.destination.areas[req.stayType === "hostel" ? "shoestring" : req.budgetTier].name,
    why: l.destination.areas[req.stayType === "hostel" ? "shoestring" : req.budgetTier].why,
  }));
  const interestText = req.interests.length ? req.interests.slice(0, 3).join(", ") : "a bit of everything";
  const party = describeParty(req);

  return {
    id: newId(),
    createdAt: new Date().toISOString(),
    request: req,
    title: tripTitle(legs, days.length),
    summary: `A ${req.pace} ${days.length}-day ${req.budgetTier} trip for ${party}, built around ${interestText}. ${legs[0].destination.tagline}`,
    days,
    stays,
    budget,
    fx,
    packing: packingList(req, legs),
    tips: buildTips(req, legs, days, budget, fx),
    source: "giro",
    palette: legs[0].destination.palette,
  };
}

/** Recompute derived totals after the traveller edits the itinerary. */
export function recalcBudget(trip: Trip): Trip {
  const legs = planLegs(trip.request);
  return { ...trip, budget: estimateBudget(trip.request, legs, trip.days) };
}

/** Catalog alternatives for a slot, excluding anything already in the trip. */
export function suggestAlternatives(trip: Trip, dayIndex: number, slot: Slot, limit = 4, taste?: TasteProfile): Activity[] {
  const day = trip.days[dayIndex];
  if (!day) return [];
  const dest = resolveDestination(day.city);
  const used = new Set(trip.days.flatMap((d) => d.activities.map((a) => a.ref ?? a.title)));
  const rank = (catalog: CatalogActivity[]) => {
    const ctx: ScoreContext = { req: trip.request, must: phrases(trip.request.mustSee), avoid: phrases(trip.request.avoid), catalogSize: catalog.length, taste };
    return catalog
      .map((act, i) => ({ act, score: scoreActivity(act, i, ctx) + (act.slot === slot ? 1.5 : 0) }))
      .filter(({ act, score }) => Number.isFinite(score) && !used.has(act.key) && !used.has(act.title) && act.hrs < 6 && fitsSlot(act, slot))
      .sort((a, b) => b.score - a.score)
      .map(({ act }) => act);
  };
  let picks = rank(dest.activities);
  // Known catalogs can run dry on long trips; top up with open-ended ideas for the city.
  if (picks.length < limit && findDestination(day.city)) picks = [...picks, ...rank(genericDestination(day.city).activities)];
  return picks.slice(0, limit).map((act) => toActivity(act, slot));
}

/** Destinations that match the traveller's interests and month, for "Inspire me". */
export function inspire(interests: Interest[], month?: number, limit = 6): Destination[] {
  return [...DESTINATIONS]
    .map((d) => {
      const catHits = d.activities.filter((a) => a.cats.some((c) => interests.includes(c))).length;
      const season = month && d.bestMonths.includes(month) ? 4 : 0;
      return { d, score: catHits + season };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ d }) => d);
}
