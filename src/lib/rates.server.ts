import "server-only";
import { CURRENCIES, FALLBACK_AS_OF, FALLBACK_RATES, parseRates, type Currency } from "./currency";

export interface RateTable {
  rates: Record<Currency, number>;
  asOf: string;
  source: "live" | "fallback";
}

const SOURCE = `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${CURRENCIES.filter((c) => c !== "USD").join(",")}`;

/** ECB reference rates via Frankfurter (free, no key), cached for 12 hours; built-in rates if unreachable. */
export async function getRates(): Promise<RateTable> {
  try {
    const res = await fetch(SOURCE, { next: { revalidate: 43_200 }, signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const parsed = parseRates(await res.json());
      if (parsed) return { ...parsed, rates: { ...parsed.rates, USD: 1 }, source: "live" };
    }
  } catch {
    /* network unavailable: fall through */
  }
  return { rates: FALLBACK_RATES, asOf: FALLBACK_AS_OF, source: "fallback" };
}
