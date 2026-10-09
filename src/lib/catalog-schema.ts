import { z } from "zod";
import { INTERESTS } from "./types.ts";

/** Schema every catalog city must satisfy, whether hand-written or drafted by Giro AI. */

const Money = z.number().min(0).max(5000);

export const CatalogActivitySchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/).describe("kebab-case id, unique within the city"),
  title: z.string().min(3).max(80),
  description: z.string().min(10).max(220),
  cats: z.array(z.enum(INTERESTS)).min(1).max(3),
  slot: z.enum(["morning", "afternoon", "evening", "any"]).describe('"any" means any daytime slot'),
  hrs: z.number().min(0.5).max(12),
  cost: Money.describe("approximate cost per adult in USD"),
  area: z.string().min(2).max(60).describe("neighbourhood or district"),
  tip: z.string().max(160).optional(),
  bookable: z.boolean().optional(),
  kids: z.boolean().optional(),
});

const Area = z.object({ name: z.string().min(2).max(80), why: z.string().min(10).max(200) });
const Daily = z.object({ lodging: Money, food: Money, transport: Money });

export const DestinationSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  country: z.string().min(2),
  aliases: z.array(z.string()),
  airport: z.string().regex(/^[A-Z]{3}$/).describe("main IATA airport or metro code"),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  region: z.enum(["north-america", "latin-america", "europe", "east-asia", "southeast-asia", "africa", "middle-east", "oceania"]).optional(),
  climate: z.enum(["temperate", "mediterranean", "tropical", "cold", "desert", "subtropical"]),
  palette: z.tuple([z.string().regex(/^#[0-9a-f]{6}$/i), z.string().regex(/^#[0-9a-f]{6}$/i)]),
  tagline: z.string().min(10).max(90),
  bestMonths: z.array(z.number().int().min(1).max(12)).max(12),
  areas: z.object({ shoestring: Area, comfort: Area, luxury: Area }),
  daily: z.object({ shoestring: Daily, comfort: Daily, luxury: Daily }),
  flightEst: Money.describe("typical economy return fare in USD from a major North American hub"),
  eats: z.array(z.string().min(5).max(120)).min(3).max(8),
  tips: z.array(z.string().min(10).max(200)).min(2).max(5),
  activities: z.array(CatalogActivitySchema).min(10).max(20),
});

export type DestinationInput = z.infer<typeof DestinationSchema>;

/** Problems beyond the schema: duplicate keys, implausible prices, weak coverage. */
export function catalogIssues(d: DestinationInput): string[] {
  const issues: string[] = [];
  const keys = new Set<string>();
  for (const a of d.activities) {
    if (keys.has(a.key)) issues.push(`duplicate activity key "${a.key}"`);
    keys.add(a.key);
  }
  const tiers = ["shoestring", "comfort", "luxury"] as const;
  for (let i = 1; i < tiers.length; i++) {
    if (d.daily[tiers[i]].lodging < d.daily[tiers[i - 1]].lodging) issues.push(`${tiers[i]} lodging is cheaper than ${tiers[i - 1]}`);
  }
  if (!d.activities.some((a) => a.slot === "evening")) issues.push("no evening activities");
  if (d.activities.filter((a) => a.kids).length < 3) issues.push("fewer than 3 kid-friendly activities");
  return issues;
}
