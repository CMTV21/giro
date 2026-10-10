/**
 * Money in Giro is computed in USD (the catalog's base) and displayed in the traveller's currency.
 * Each trip snapshots the rate it was planned with, so its numbers don't drift day to day.
 */

export const CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD", "NZD", "MXN", "JPY", "CHF", "INR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Currencies a booking can be paid in: the display currencies plus other ECB-quoted ones travellers often pay locally. */
export const PAY_CURRENCIES = [...CURRENCIES, "CZK", "THB", "TRY", "KRW", "SGD", "ZAR", "ISK", "DKK", "SEK", "NOK", "PLN", "HUF", "HKD", "IDR", "CNY", "BRL"] as const;
export type PayCurrency = (typeof PAY_CURRENCIES)[number];
export const isPayCurrency = (v: unknown): v is PayCurrency => typeof v === "string" && (PAY_CURRENCIES as readonly string[]).includes(v);

/** Live rates (units per USD) for payment-only currencies, from the same ECB feed. */
export function parseExtraRates(json: unknown): Partial<Record<PayCurrency, number>> {
  const rates = (json as { rates?: Record<string, unknown> } | undefined)?.rates;
  const out: Partial<Record<PayCurrency, number>> = {};
  if (!rates || typeof rates !== "object") return out;
  for (const c of PAY_CURRENCIES) {
    if ((CURRENCIES as readonly string[]).includes(c)) continue;
    const v = rates[c];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[c] = v;
  }
  return out;
}

export const DEFAULT_CURRENCY: Currency = "CAD";

export const CURRENCY_NAMES: Record<Currency, string> = {
  CAD: "Canadian dollar",
  USD: "US dollar",
  EUR: "Euro",
  GBP: "British pound",
  AUD: "Australian dollar",
  NZD: "New Zealand dollar",
  MXN: "Mexican peso",
  JPY: "Japanese yen",
  CHF: "Swiss franc",
  INR: "Indian rupee",
};

/**
 * Offline fallback: units of each currency per 1 USD. Approximate, used only when live
 * rates (ECB reference rates via Frankfurter) can't be fetched. Update periodically.
 */
export const FALLBACK_RATES: Record<Currency, number> = {
  USD: 1,
  CAD: 1.38,
  EUR: 0.88,
  GBP: 0.76,
  AUD: 1.53,
  NZD: 1.7,
  MXN: 18.6,
  JPY: 148,
  CHF: 0.81,
  INR: 87,
};
export const FALLBACK_AS_OF = "2026-09-01";

export interface FxSnapshot {
  currency: Currency;
  /** Units of `currency` per 1 USD. */
  rate: number;
  asOf: string;
  source: "live" | "fallback";
}

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

export function fallbackFx(currency: Currency): FxSnapshot {
  return { currency, rate: FALLBACK_RATES[currency], asOf: FALLBACK_AS_OF, source: "fallback" };
}

/** Parse a Frankfurter `latest?base=USD` response into a full rate table (missing values fall back). */
export function parseRates(json: unknown): { rates: Record<Currency, number>; asOf: string } | undefined {
  if (!json || typeof json !== "object") return undefined;
  const { rates, date } = json as { rates?: Record<string, unknown>; date?: unknown };
  if (!rates || typeof rates !== "object") return undefined;
  const out = { ...FALLBACK_RATES };
  let live = 0;
  for (const c of CURRENCIES) {
    const v = rates[c];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      out[c] = v;
      live++;
    }
  }
  if (!live) return undefined;
  return { rates: out, asOf: typeof date === "string" ? date : new Date().toISOString().slice(0, 10) };
}

export const toLocal = (usd: number, rate: number) => usd * rate;
export const toUSD = (amount: number, rate: number) => (rate > 0 ? amount / rate : amount);

const formatters = new Map<string, Intl.NumberFormat>();

/** Format a USD amount in the snapshot's currency, e.g. "$1,240" (CAD) or "US$900" for Canadian readers. */
export function formatMoney(usd: number, fx: Pick<FxSnapshot, "currency" | "rate">, opts: { approx?: boolean } = {}): string {
  return formatLocal(toLocal(usd, fx.rate), fx.currency, opts);
}

/** Format an amount already in `currency`. */
export function formatLocal(amount: number, currency: Currency, opts: { approx?: boolean } = {}): string {
  const key = currency;
  let f = formatters.get(key);
  if (!f) {
    // en-CA renders CAD as "$" and other dollars with a prefix ("US$", "A$"), which reads naturally for Canadians.
    f = new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 0, minimumFractionDigits: 0 });
    formatters.set(key, f);
  }
  const rounded = Math.abs(amount) >= 1000 ? Math.round(amount / 10) * 10 : Math.round(amount);
  return `${opts.approx ? "~" : ""}${f.format(rounded)}`;
}

export function currencySymbol(currency: Currency): string {
  const parts = new Intl.NumberFormat("en-CA", { style: "currency", currency }).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? currency;
}
