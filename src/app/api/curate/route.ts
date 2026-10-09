import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AIRefusalError, aiAvailable, curateWithClaude } from "@/lib/ai";
import { isValidISODate, nightsBetween } from "@/lib/dates";
import { BUDGET_TIERS, INTERESTS, PACES, STAY_TYPES } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const RequestSchema = z.object({
  destinations: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
  origin: z.string().max(80).default(""),
  startDate: z.string().refine(isValidISODate),
  endDate: z.string().refine(isValidISODate),
  adults: z.number().int().min(1).max(16),
  children: z.number().int().min(0).max(10),
  budgetTier: z.enum(BUDGET_TIERS),
  totalBudget: z.number().positive().max(10_000_000).optional(),
  pace: z.enum(PACES),
  interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length),
  stayType: z.enum(STAY_TYPES),
  mustSee: z.string().max(500).optional(),
  avoid: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  useAI: z.boolean().optional(),
});

// Best-effort abuse guard for an unauthenticated endpoint that spends API credit.
// It is per server instance; put a shared limiter (e.g. Redis, edge rate limiting) in front for production.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function rateLimited(request: Request): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return true;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

export async function GET() {
  return NextResponse.json({ ai: aiAvailable() });
}

export async function POST(request: Request) {
  if (!aiAvailable()) {
    return NextResponse.json({ error: "ai_unavailable", message: "Giro AI isn't configured on this server." }, { status: 503 });
  }

  if (rateLimited(request)) {
    return NextResponse.json({ error: "rate_limited", message: "Too many AI requests. Please wait a few minutes." }, { status: 429 });
  }

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  const nights = nightsBetween(parsed.data.startDate, parsed.data.endDate);
  if (nights < 1 || nights > 29) {
    return NextResponse.json({ error: "invalid_dates", message: "Trips must be between 1 and 29 nights." }, { status: 400 });
  }

  try {
    const trip = await curateWithClaude(parsed.data);
    return NextResponse.json({ trip });
  } catch (err) {
    if (err instanceof AIRefusalError) {
      return NextResponse.json({ error: "ai_refused", message: err.message }, { status: 422 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "ai_busy", message: "Giro AI is busy. Please try again shortly." }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic authentication failed; check ANTHROPIC_API_KEY.");
      return NextResponse.json({ error: "ai_unavailable", message: "Giro AI isn't configured correctly." }, { status: 503 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      return NextResponse.json({ error: "ai_error", message: "Giro AI hit a problem." }, { status: 502 });
    }
    console.error("AI curation failed", err);
    return NextResponse.json({ error: "ai_error", message: "Giro AI hit a problem." }, { status: 502 });
  }
}
