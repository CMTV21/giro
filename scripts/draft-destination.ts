/**
 * Draft a new catalog city with Claude, for human review.
 *
 *   ANTHROPIC_API_KEY=... node --experimental-strip-types scripts/draft-destination.ts "Porto" [--country Portugal]
 *
 * Writes catalog-drafts/<slug>.json. Review every place, price and coordinate, then run
 * scripts/promote-destination.ts <slug> to add it to the live catalog.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { mkdirSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { catalogIssues, DestinationSchema } from "../src/lib/catalog-schema.ts";
import { DESTINATIONS, findDestination } from "../src/lib/destinations.ts";
import { INTERESTS } from "../src/lib/types.ts";

const MODEL = "claude-opus-5-5";

// Request schema: plain types only (structured outputs drop numeric/length limits; the strict
// DestinationSchema re-validates everything locally afterwards).
const Area = z.object({ name: z.string(), why: z.string() });
const Daily = z.object({ lodging: z.number(), food: z.number(), transport: z.number() });
const DraftSchema = z.object({
  name: z.string(),
  country: z.string(),
  aliases: z.array(z.string()),
  airport: z.string().describe("Main IATA airport or metro code, uppercase"),
  lat: z.number(),
  lon: z.number(),
  region: z.enum(["north-america", "latin-america", "europe", "east-asia", "southeast-asia", "africa", "middle-east", "oceania"]),
  climate: z.enum(["temperate", "mediterranean", "tropical", "cold", "desert", "subtropical"]),
  paletteFrom: z.string().describe("Deep hex colour evoking the city, e.g. #1e3a8a"),
  paletteTo: z.string().describe("Second hex colour for a gradient, e.g. #f472b6"),
  tagline: z.string().describe("Under 70 characters"),
  bestMonths: z.array(z.number()),
  areas: z.object({ shoestring: Area, comfort: Area, luxury: Area }),
  daily: z.object({ shoestring: Daily, comfort: Daily, luxury: Daily }),
  flightEst: z.number().describe("Typical economy return fare in USD from Toronto or New York"),
  eats: z.array(z.string()),
  tips: z.array(z.string()),
  activities: z.array(
    z.object({
      key: z.string().describe("kebab-case, unique"),
      title: z.string(),
      description: z.string().describe("One sentence, under 200 characters"),
      cats: z.array(z.enum(INTERESTS)),
      slot: z.enum(["morning", "afternoon", "evening", "any"]),
      hrs: z.number(),
      cost: z.number().describe("Per adult in USD, 0 if free"),
      area: z.string(),
      tip: z.string().describe("Empty string if none"),
      bookable: z.boolean(),
      kids: z.boolean(),
    }),
  ),
});

const SYSTEM = `You are a meticulous travel editor building Giro's destination catalog.
Only include places, venues and experiences that you are confident exist and are well established; never invent them.
Prefer the experiences a thoughtful local would recommend, spread across neighbourhoods and interests, including at least three evening options and at least three that suit children.
Prices are honest USD estimates per adult. Daily costs are: lodging per room-night, food and local transport per person-day, for each budget tier.
"any" slot means any daytime slot (parks and markets close in the evening). Return 12 to 14 activities, iconic ones first.`;

const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const args = process.argv.slice(2);
  const city = args.find((a) => !a.startsWith("--"));
  const country = args.includes("--country") ? args[args.indexOf("--country") + 1] : undefined;
  if (!city) throw new Error('Usage: draft-destination.ts "City" [--country Country]');
  const existing = findDestination(city);
  if (existing) throw new Error(`${existing.name} is already in the catalog.`);

  const client = new Anthropic();
  const examples = DESTINATIONS.slice(0, 2).map((d) => JSON.stringify({ name: d.name, tagline: d.tagline, activity: d.activities[0] }));
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(DraftSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Draft the catalog entry for ${city}${country ? `, ${country}` : ""}.\nStyle examples from existing entries:\n${examples.join("\n")}` }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to draft this destination.");
  const draft = message.parsed_output;
  if (!draft) throw new Error(`Could not parse the draft (stop_reason: ${message.stop_reason}).`);

  const entry = {
    slug: slugify(draft.name),
    name: draft.name,
    country: draft.country,
    aliases: draft.aliases,
    airport: draft.airport.toUpperCase(),
    lat: draft.lat,
    lon: draft.lon,
    region: draft.region,
    climate: draft.climate,
    palette: [draft.paletteFrom, draft.paletteTo],
    tagline: draft.tagline,
    bestMonths: [...new Set(draft.bestMonths.filter((m) => m >= 1 && m <= 12))],
    areas: draft.areas,
    daily: draft.daily,
    flightEst: draft.flightEst,
    eats: draft.eats,
    tips: draft.tips,
    activities: draft.activities.map(({ tip, ...a }) => ({ ...a, ...(tip ? { tip } : {}) })),
  };

  const parsed = DestinationSchema.safeParse(entry);
  const issues = parsed.success ? catalogIssues(parsed.data) : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  mkdirSync("catalog-drafts", { recursive: true });
  const file = `catalog-drafts/${entry.slug}.json`;
  writeFileSync(
    file,
    JSON.stringify({ status: "needs-review", draftedBy: MODEL, draftedAt: new Date().toISOString(), issues, review: ["Every place exists and is open", "Prices look right", "Coordinates point at the city centre", "Areas to stay are accurate"], entry }, null, 2) + "\n",
  );
  console.log(`Wrote ${file}${issues.length ? ` with ${issues.length} issue(s) to fix:\n- ${issues.join("\n- ")}` : " (passes validation)"}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
