/**
 * A bookable tour or ticket matched to a stop (from a partner API), and the rules for trusting
 * a match. Parsing is defensive: only fields we can check are kept.
 */

export interface TourOffer {
  provider: "Viator";
  code: string;
  title: string;
  url: string;
  /** "From" price in `currency`, per person. */
  fromPrice?: number;
  currency: string;
  rating?: number;
  reviews?: number;
  freeCancellation: boolean;
  durationMins?: number;
}

const STOP = new Set(["the", "and", "with", "tour", "tours", "ticket", "tickets", "entry", "visit", "guided", "private", "skip", "line", "from", "day", "trip", "old", "town", "city", "museum", "walk", "walking"]);

/** Distinctive words (4+ letters, accents removed) used to check a match is about this stop. */
export function keywords(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

/** A product counts as this stop when it shares a distinctive word with the stop's name. */
export function matchesStop(stopTitle: string, productTitle: string): boolean {
  const want = new Set(keywords(stopTitle));
  return want.size > 0 && keywords(productTitle).some((w) => want.has(w));
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** One product summary from Viator's search responses. */
export function parseViatorProduct(raw: unknown, currency: string): TourOffer | undefined {
  const p = raw as Record<string, unknown> | undefined;
  if (!p || typeof p !== "object") return undefined;
  const code = text(p.productCode);
  const title = text(p.title);
  const url = text(p.productUrl);
  if (!code || !title || !url) return undefined;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !/(^|\.)viator\.com$/.test(u.hostname)) return undefined;
  } catch {
    return undefined;
  }
  const pricing = (p.pricing ?? {}) as { summary?: { fromPrice?: unknown }; currency?: unknown };
  const reviews = (p.reviews ?? {}) as { combinedAverageRating?: unknown; totalReviews?: unknown };
  const duration = (p.duration ?? {}) as { fixedDurationInMinutes?: unknown; variableDurationFromMinutes?: unknown };
  const flags = Array.isArray(p.flags) ? p.flags : [];
  const priceCurrency = text(pricing.currency) ?? currency;
  const fromPrice = num(pricing.summary?.fromPrice);
  const rating = num(reviews.combinedAverageRating);
  const count = num(reviews.totalReviews);
  return {
    provider: "Viator",
    code,
    title: title.slice(0, 160),
    url,
    fromPrice: fromPrice && fromPrice > 0 && priceCurrency === currency ? Math.round(fromPrice * 100) / 100 : undefined,
    currency,
    rating: rating && rating > 0 && rating <= 5 ? Math.round(rating * 10) / 10 : undefined,
    reviews: count && count > 0 ? Math.round(count) : undefined,
    freeCancellation: flags.includes("FREE_CANCELLATION"),
    durationMins: num(duration.fixedDurationInMinutes) ?? num(duration.variableDurationFromMinutes),
  };
}
