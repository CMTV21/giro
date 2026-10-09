import { z } from "zod";
import { CURRENCIES } from "./currency.ts";
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
});

const RequestSchema = z.object({
  destinations: z.array(str(80)).min(1).max(6),
  origin: str(80),
  startDate: date,
  endDate: date,
  adults: z.number().int().min(1).max(16),
  children: z.number().int().min(0).max(10),
  budgetTier: z.enum(BUDGET_TIERS),
  currency: z.enum(CURRENCIES).optional(),
  totalBudget: z.number().positive().max(100_000_000).optional(),
  pace: z.enum(PACES),
  interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length),
  stayType: z.enum(STAY_TYPES),
  mustSee: str(500).optional(),
  avoid: str(500).optional(),
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
    .array(z.object({ city: str(80), checkIn: date, checkOut: date, nights: z.number().int().min(0).max(31), area: str(160), why: str(400) }))
    .max(6),
  budget: z.object({ flights: usd, lodging: usd, food: usd, activities: usd, localTransport: usd, total: usd, perPerson: usd }),
  fx: z.object({ currency: z.enum(CURRENCIES), rate: z.number().positive().max(100_000), asOf: str(20), source: z.enum(["live", "fallback"]) }).optional(),
  packing: z.array(str(200)).max(60),
  tips: z.array(str(400)).max(30),
  source: z.enum(["giro", "ai"]),
  palette: z.tuple([hex, hex]),
  packed: z.array(str(200)).max(60).optional(),
});

export function parseTrip(value: unknown): Trip | undefined {
  const parsed = TripSchema.safeParse(value);
  return parsed.success ? (parsed.data as Trip) : undefined;
}
