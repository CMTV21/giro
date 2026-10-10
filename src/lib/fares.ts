/**
 * Recently seen airfares (Travelpayouts / Aviasales data API). These are prices other travellers
 * found in the last few days, not live quotes, so they're shown as "seen recently from".
 */

export interface Fare {
  /** Return price per adult in the requested currency. */
  price: number;
  airline?: string;
  departDate: string;
  returnDate?: string;
  /** Stops on the way out. */
  transfers?: number;
  /** Where to see it (https://www.aviasales.com/...). */
  url?: string;
}

export interface FareSummary {
  currency: string;
  /** Cheapest for exactly the trip's dates. */
  exact?: Fare;
  /** Cheapest with the same trip length departing up to 3 days either side, when cheaper. */
  nearby?: Fare;
}

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s);
const nightsBetween = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86_400_000);

/** One row of prices_for_dates. */
export function parseFare(raw: unknown): Fare | undefined {
  const r = raw as Record<string, unknown> | undefined;
  if (!r || typeof r !== "object") return undefined;
  const price = typeof r.price === "number" && Number.isFinite(r.price) && r.price > 0 ? r.price : undefined;
  if (!price || !isDate(r.departure_at)) return undefined;
  const link = typeof r.link === "string" && r.link.startsWith("/") && !r.link.startsWith("//") ? r.link : undefined;
  return {
    price: Math.round(price),
    airline: typeof r.airline === "string" && /^[A-Z0-9]{2}$/.test(r.airline) ? r.airline : undefined,
    departDate: r.departure_at.slice(0, 10),
    returnDate: isDate(r.return_at) ? r.return_at.slice(0, 10) : undefined,
    transfers: typeof r.transfers === "number" ? r.transfers : undefined,
    url: link ? `https://www.aviasales.com${link}` : undefined,
  };
}

/** From a month's fares, the cheapest for the exact dates and a cheaper same-length option within 3 days. */
export function summarizeFares(rows: unknown[], depart: string, ret: string, currency: string): FareSummary {
  const nights = nightsBetween(depart, ret);
  const fares = rows.map(parseFare).filter((f): f is Fare => Boolean(f && f.returnDate));
  const sameLength = fares.filter((f) => nightsBetween(f.departDate, f.returnDate!) === nights);
  const cheapest = (list: Fare[]) => list.reduce<Fare | undefined>((best, f) => (!best || f.price < best.price ? f : best), undefined);
  const exact = cheapest(sameLength.filter((f) => f.departDate === depart));
  const near = cheapest(sameLength.filter((f) => f.departDate !== depart && Math.abs(nightsBetween(depart, f.departDate)) <= 3));
  // Only worth mentioning if it saves a real amount.
  const nearby = near && (!exact || near.price <= exact.price * 0.9) ? near : undefined;
  return { currency, exact, nearby };
}
