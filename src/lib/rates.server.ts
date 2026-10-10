import "server-only";
import { FALLBACK_AS_OF, FALLBACK_RATES, PAY_CURRENCIES, parseExtraRates, parseRates, type Currency, type PayCurrency } from "./currency.ts";

export interface RateTable {
  rates: Record<Currency, number>;
  /** Payment-only currencies; present only when the live feed answered (no stale guesses). */
  extra?: Partial<Record<PayCurrency, number>>;
  asOf: string;
  source: "live" | "fallback";
}

const SOURCE = `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${PAY_CURRENCIES.filter((c) => c !== "USD").join(",")}`;

/** ECB reference rates via Frankfurter (free, no key), cached for 12 hours; built-in rates if unreachable. */
export async function getRates(): Promise<RateTable> {
  try {
    const res = await fetch(SOURCE, { next: { revalidate: 43_200 }, signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json = await res.json();
      const parsed = parseRates(json);
      if (parsed) return { ...parsed, rates: { ...parsed.rates, USD: 1 }, extra: parseExtraRates(json), source: "live" };
    }
  } catch {
    /* network unavailable: fall through */
  }
  return { rates: FALLBACK_RATES, asOf: FALLBACK_AS_OF, source: "fallback" };
}
