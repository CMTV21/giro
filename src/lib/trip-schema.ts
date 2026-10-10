import { z } from "zod";
import { ACCESS_NEEDS } from "./access.ts";
import { CURRENCIES, PAY_CURRENCIES } from "./currency.ts";
import { BUDGET_TIERS, INTERESTS, PACES, STAY_TYPES, type Trip } from "./types.ts";

/**
 * Shape check for trips arriving from clients (saves, imports, share links). Bounds keep a
 * malicious or buggy client from storing oversized or malformed documents.
 */

const str = (max: number) => z.string().max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const usd = z.number().min(0).max(10_000_000);

const ActivitySchema = z.object({
  id: str(40),
  title: str(160),
  description: str(600),
  category: z.enum([...INTERESTS, "transit", "free"]),
  slot: z.enum(["morning", "afternoon", "evening"]),
  durationHrs: z.number().min(0).max(24),
  estCost: usd,
  area: str(120).optional(),
  tip: str(400).optional(),
  bookable: z.boolean().optional(),
  booked: z.boolean().optional(),
  ref: str(80).optional(),
  start: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  place: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).optional(),
  note: str(500).optional(),
  custom: z.boolean().optional(),
  picked: z.boolean().optional(),
  travel: z.object({ from: str(40), mins: z.number().int().min(0).max(600), mode: z.enum(["walk", "ride"]) }).optional(),
});

const time = z.string().regex(/^\d{1,2}:\d{2}$/);

const PaidSchema = z.object({ amount: z.number().min(0).max(100_000_000), currency: z.enum(PAY_CURRENCIES), usd: usd });

const FlightSchema = z.object({
  id: str(40),
  kind: z.enum(["outbound", "return", "between"]),
  airline: str(80).optional(),
  flightNumber: str(20).optional(),
  from: str(80),
  to: str(80),
  departDate: date,
  departTime: time,
  arriveDate: date,
  arriveTime: time,
  confirmation: str(40).optional(),
  paid: PaidSchema.optional(),
});

const StayBookingSchema = z.object({
  name: str(160),
  address: str(300).optional(),
  checkInTime: time.optional(),
  checkOutTime: time.optional(),
  confirmation: str(40).optional(),
  url: z.string().url().max(500).refine((u) => /^https?:\/\//i.test(u), "Links must start with http(s)://").optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  paid: PaidSchema.optional(),
});

const RequestSchema = z.object({
  destinations: z.array(str(80)).min(1).max(6),
  origin: str(80),
  startDate: date,
  endDate: date,
  adults: z.number().int().min(1).max(16),
  children: z.number().int().min(0).max(10),
  childAges: z.array(z.number().int().min(0).max(17)).max(10).optional(),
  budgetTier: z.enum(BUDGET_TIERS),
  currency: z.enum(CURRENCIES).optional(),
  totalBudget: z.number().positive().max(100_000_000).optional(),
  pace: z.enum(PACES),
  interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length),
  stayType: z.enum(STAY_TYPES),
  mustSee: str(500).optional(),
  avoid: str(500).optional(),
  access: z.array(z.enum(ACCESS_NEEDS)).max(ACCESS_NEEDS.length).optional(),
  notes: str(1000).optional(),
  useAI: z.boolean().optional(),
});

const hex = z.string().regex(/^#[0-9a-f]{3,8}$/i);

export const TripSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  createdAt: str(40),
  request: RequestSchema,
  title: str(160),
  summary: str(1000),
  days: z
    .array(
      z.object({
        index: z.number().int().min(0).max(60),
        date,
        city: str(80),
        theme: str(160),
        activities: z.array(ActivitySchema).max(20),
        eat: str(300).optional(),
      }),
    )
    .min(1)
    .max(31),
  stays: z
    .array(z.object({ city: str(80), checkIn: date, checkOut: date, nights: z.number().int().min(0).max(31), area: str(160), why: str(400), booking: StayBookingSchema.optional() }))
    .max(6),
  budget: z.object({ flights: usd, lodging: usd, food: usd, activities: usd, localTransport: usd, total: usd, perPerson: usd, booked: z.object({ flights: usd.optional(), lodging: usd.optional() }).optional() }),
  fx: z.object({ currency: z.enum(CURRENCIES), rate: z.number().positive().max(100_000), asOf: str(20), source: z.enum(["live", "fallback"]) }).optional(),
  packing: z.array(str(200)).max(60),
  tips: z.array(str(400)).max(30),
  source: z.enum(["giro", "ai"]),
  palette: z.tuple([hex, hex]),
  packed: z.array(str(200)).max(60).optional(),
  packingAdded: z.array(str(120)).max(60).optional(),
  packingRemoved: z.array(str(200)).max(60).optional(),
  notes: str(5000).optional(),
  flights: z.array(FlightSchema).max(12).optional(),
  parked: z.array(ActivitySchema.extend({ city: str(80), reason: str(200).optional() })).max(100).optional(),
  advisorySeen: z.record(z.string().regex(/^[A-Z]{2}$/), z.number().int().min(0).max(3)).refine((r) => Object.keys(r).length <= 12).optional(),
  food: z
    .array(
      z.object({
        city: str(80),
        dishes: z.array(z.object({ name: str(80), what: str(300), wiki: str(120).optional() })).max(12),
        restaurants: z
          .array(z.object({ name: str(100), area: str(100), kind: str(80), price: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), meal: z.enum(["breakfast", "lunch", "dinner"]), why: str(300), book: z.boolean().optional() }))
          .max(15),
      }),
    )
    .max(6)
    .optional(),
});

export function parseTrip(value: unknown): Trip | undefined {
  const parsed = TripSchema.safeParse(value);
  return parsed.success ? (parsed.data as Trip) : undefined;
}
