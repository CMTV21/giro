import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { buildDays, estimateBudget, newId, normalizeRequest, packingList, planLegs, resolveFx, tripTitle } from "./curate.ts";
import type { FxSnapshot } from "./currency.ts";
import type { TasteProfile } from "./taste.ts";
import { INTERESTS, type Activity, type Day, type Trip, type TripRequest } from "./types.ts";

export const AI_MODEL = "claude-opus-5-5";

const ActivitySchema = z.object({
  title: z.string().describe("Specific, real place or experience name"),
  description: z.string().describe("One or two vivid sentences on why it's worth it"),
  category: z.enum([...INTERESTS, "transit", "free"]),
  slot: z.enum(["morning", "afternoon", "evening"]),
  durationHrs: z.number(),
  estCost: z.number().describe("Approximate cost per adult in USD; 0 if free"),
  area: z.string().describe("Neighbourhood or district"),
  tip: z.string().describe("Insider tip, or empty string"),
  bookable: z.boolean().describe("True if tickets or a tour should be booked ahead"),
});

const PlanSchema = z.object({
  title: z.string(),
  summary: z.string().describe("Two sentences selling the trip, written to the traveller"),
  days: z.array(
    z.object({
      theme: z.string(),
      eat: z.string().describe("One specific food or restaurant recommendation for the day"),
      activities: z.array(ActivitySchema),
    }),
  ),
  stays: z.array(z.object({ city: z.string(), area: z.string(), why: z.string() })),
  tips: z.array(z.string()),
  packing: z.array(z.string()),
});

const SYSTEM = `You are Giro's senior travel curator. You design realistic, delightful day-by-day itineraries.

Principles:
- Use real, specific places, restaurants and experiences that exist. Never invent venues.
- Cluster each day geographically to minimise transit; order activities morning → afternoon → evening.
- Respect the requested pace: relaxed ≈ 2 activities/day, balanced ≈ 3, packed ≈ 4. Arrival, transfer and departure days are lighter and must start or end with a "transit" activity.
- Respect the party: with children, choose kid-friendly options and avoid late nightlife; honour must-sees and never include anything the traveller asked to avoid.
- Costs are honest per-adult USD estimates. Mark bookable=true only when advance tickets genuinely help.
- Match the budget tier in restaurant and activity choices.
- Tips should be practical and specific to these dates and places (seasonal events, closures, transport passes).`;

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export class AIRefusalError extends Error {}

function skeleton(req: TripRequest, taste?: TasteProfile) {
  const legs = planLegs(req);
  const days = buildDays(req, legs, taste);
  const lines = days.map((d, i) => {
    const kind = i === 0 ? "arrival" : i === days.length - 1 ? "departure" : d.activities[0]?.category === "transit" ? "transfer" : "full day";
    return `Day ${i + 1} — ${d.date} — ${d.city} (${kind})`;
  });
  return { legs, days, lines };
}

/** Ask Claude to curate the trip, then merge onto Giro's date/leg skeleton so the shape is always valid. */
export interface AICurateOptions {
  client?: Anthropic;
  fx?: FxSnapshot;
  taste?: TasteProfile;
}

export async function curateWithClaude(input: TripRequest, opts: AICurateOptions = {}): Promise<Trip> {
  const client = opts.client ?? new Anthropic();
  const req = normalizeRequest(input);
  const fx = resolveFx(req, opts.fx);
  const { legs, days: fallbackDays, lines } = skeleton(req, opts.taste);

  const brief = [
    `Destinations (in order, with nights): ${legs.map((l) => `${l.city} (${l.nights} nights)`).join(" → ")}`,
    `Travelling from: ${req.origin || "not specified"}`,
    `Dates: ${req.startDate} to ${req.endDate}`,
    `Party: ${req.adults} adults, ${req.children} children`,
    `Budget tier: ${req.budgetTier}${req.totalBudget ? `, total budget about ${req.totalBudget} ${fx.currency} for the whole party (≈ ${Math.round(req.totalBudget / fx.rate)} USD)` : ""}`,
    `The traveller thinks in ${fx.currency}; still give every estCost in USD.`,
    `Pace: ${req.pace}`,
    `Interests: ${req.interests.join(", ") || "open to anything"}`,
    `Preferred stay: ${req.stayType}`,
    req.mustSee ? `Must see / do: ${req.mustSee}` : "",
    req.avoid ? `Avoid: ${req.avoid}` : "",
    req.notes ? `Other notes from the traveller: ${req.notes}` : "",
    "",
    `Return exactly ${lines.length} days, in this order:`,
    ...lines,
    "",
    `Return one stay recommendation per destination (${legs.map((l) => l.city).join(", ")}).`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  const stream = client.beta.messages.stream({
    model: AI_MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(PlanSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: brief }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") throw new AIRefusalError("The AI curator declined this request.");
  const plan = message.parsed_output;
  if (!plan) throw new Error(`AI response could not be parsed (stop_reason: ${message.stop_reason}).`);

  const days: Day[] = fallbackDays.map((fallback, i) => {
    const ai = plan.days[i];
    if (!ai || ai.activities.length === 0) return fallback;
    const activities: Activity[] = ai.activities.map((a) => ({
      id: newId(),
      title: a.title,
      description: a.description,
      category: a.category,
      slot: a.slot,
      durationHrs: Math.max(0.5, a.durationHrs),
      estCost: Math.max(0, Math.round(a.estCost)),
      area: a.area || undefined,
      tip: a.tip || undefined,
      bookable: a.bookable,
    }));
    return { ...fallback, theme: ai.theme || fallback.theme, eat: ai.eat || fallback.eat, activities };
  });

  const budget = estimateBudget(req, legs, days);
  return {
    id: newId(),
    createdAt: new Date().toISOString(),
    request: { ...req, useAI: true },
    title: plan.title || tripTitle(legs, days.length),
    summary: plan.summary,
    days,
    stays: legs.map((l, i) => {
      const ai = plan.stays.find((s) => s.city.toLowerCase().includes(l.city.toLowerCase())) ?? plan.stays[i];
      const fallbackArea = l.destination.areas[req.budgetTier];
      return {
        city: l.city,
        checkIn: l.checkIn,
        checkOut: l.checkOut,
        nights: l.nights,
        area: ai?.area || fallbackArea.name,
        why: ai?.why || fallbackArea.why,
      };
    }),
    budget,
    fx,
    packing: plan.packing.length ? plan.packing : packingList(req, legs),
    tips: plan.tips,
    source: "ai",
    palette: legs[0].destination.palette,
  };
}
