"use client";

import { Info, Wallet } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { formatLocal } from "@/lib/currency";
import { tripFx } from "@/lib/money";
import type { Trip } from "@/lib/types";

// Categorical slots validated for CVD separation on the light surface; always paired with the labelled table below.
type Key = "flights" | "lodging" | "food" | "activities" | "localTransport";
const SEGMENTS: { key: Key; label: string; color: string; note: string }[] = [
  { key: "flights", label: "Flights", color: "#2a78d6", note: "Typical economy fares (business for luxury). Check live prices." },
  { key: "lodging", label: "Stays", color: "#eb6834", note: "Typical nightly rate in the recommended area." },
  { key: "food", label: "Food & drink", color: "#1baf7a", note: "Three meals plus coffee and snacks per day." },
  { key: "activities", label: "Activities", color: "#eda100", note: "Sum of entry fees and tours on your itinerary." },
  { key: "localTransport", label: "Getting around", color: "#e87ba4", note: "Metro, taxis and transfers between cities." },
];


export function BudgetPanel({ trip }: { trip: Trip }) {
  const fx = tripFx(trip);
  // Work in the trip's currency throughout; the target is entered in it.
  const t = trip.budget;
  const b: Record<Key | "total" | "perPerson", number> = {
    flights: t.flights * fx.rate,
    lodging: t.lodging * fx.rate,
    food: t.food * fx.rate,
    activities: t.activities * fx.rate,
    localTransport: t.localTransport * fx.rate,
    total: t.total * fx.rate,
    perPerson: t.perPerson * fx.rate,
  };
  const target = trip.request.totalBudget;
  // What's actually been paid (flights and stays with a price), in the trip's currency.
  const paid = { flights: (t.booked?.flights ?? 0) * fx.rate, lodging: (t.booked?.lodging ?? 0) * fx.rate };
  const paidTotal = paid.flights + paid.lodging;
  const pricedStays = trip.stays.filter((s) => s.booking?.paid).length;
  const noteFor = (key: Key, fallback: string) => {
    if (key === "flights" && t.booked?.flights !== undefined) return "What you paid for your booked flights.";
    if (key === "flights" && trip.fareQuote) return `Based on a ${trip.fareQuote.from}–${trip.fareQuote.to} fare seen ${formatDate(trip.fareQuote.seenAt, { month: "short", day: "numeric" })}${trip.request.budgetTier === "luxury" ? ", scaled up for business class" : ""}.`;
    if (key === "lodging" && t.booked?.lodging !== undefined)
      return pricedStays === trip.stays.length ? "What you paid for your stays." : `What you paid for ${pricedStays} of ${trip.stays.length} stays, plus estimates for the rest.`;
    return fallback;
  };
  const usd = (n: number) => formatLocal(n, fx.currency);
  const [hover, setHover] = useState<string>();
  const parts = SEGMENTS.filter((s) => b[s.key] > 0);
  const people = trip.request.adults + trip.request.children;
  const days = trip.days.length;
  const scale = Math.max(b.total, target ?? 0) || 1;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={paidTotal > 0 ? "Trip total" : "Estimated total"} value={usd(b.total)} sub={paidTotal > 0 ? "what you've paid plus estimates for the rest" : `for ${people} traveller${people > 1 ? "s" : ""}`} strong />
        {paidTotal > 0 ? (
          <Stat label="Paid so far" value={usd(paidTotal)} sub={[paid.flights > 0 && "flights", paid.lodging > 0 && "stays"].filter(Boolean).join(" and ") + ` · ${usd(b.total - paidTotal)} still to spend`} />
        ) : (
          <Stat label="Per person" value={usd(b.perPerson)} sub={`about ${usd(b.perPerson / days)} a day`} />
        )}
        {target ? (
          <Stat
            label="Your budget"
            value={usd(target)}
            sub={b.total <= target ? `${usd(target - b.total)} to spare` : `${usd(b.total - target)} over`}
            tone={b.total <= target ? "good" : "over"}
          />
        ) : (
          <Stat label="Daily spend" value={usd(b.total / days)} sub="for the whole group" />
        )}
      </div>

      <section className="card p-5 sm:p-6" aria-labelledby="budget-chart-title">
        <h3 id="budget-chart-title" className="flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4" /> Where the money goes</h3>
        <div className="relative mt-5">
          <div className="flex h-7 w-full gap-[2px]" role="img" aria-label={parts.map((p) => `${p.label} ${usd(b[p.key])}`).join(", ")}>
            {parts.map((p, i) => (
              <div
                key={p.key}
                className={`relative h-full transition-opacity ${hover && hover !== p.key ? "opacity-40" : ""} ${i === 0 ? "rounded-l-[4px]" : ""} ${i === parts.length - 1 && !target ? "rounded-r-[4px]" : ""}`}
                style={{ width: `${(b[p.key] / scale) * 100}%`, background: p.color }}
                onMouseEnter={() => setHover(p.key)}
                onMouseLeave={() => setHover(undefined)}
              >
                {hover === p.key && (
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lift">
                    {p.label} · {usd(b[p.key])} · {Math.round((b[p.key] / b.total) * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
          {target && (
            <div className="pointer-events-none absolute -top-2 -bottom-2 w-0.5 bg-ink" style={{ left: `${Math.min(100, (target / scale) * 100)}%` }}>
              <span className="absolute top-full mt-1 -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap text-ink">Budget</span>
            </div>
          )}
        </div>

        <table className="mt-12 w-full text-sm">
          <caption className="sr-only">Budget by category</caption>
          <thead>
            <tr className="text-left text-xs text-muted uppercase">
              <th className="pb-2 font-semibold">Category</th>
              <th className="pb-2 text-right font-semibold">Amount</th>
              <th className="hidden pb-2 text-right font-semibold sm:table-cell">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {SEGMENTS.map((s) => (
              <tr key={s.key} onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(undefined)} className="align-top">
                <td className="py-3 pr-3">
                  <span className="flex items-center gap-2.5 font-medium">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                    {s.label}
                    {(s.key === "flights" || s.key === "lodging") && t.booked?.[s.key] !== undefined && <span className="rounded-full bg-sea-soft px-2 py-0.5 text-[11px] font-semibold text-sea">Paid</span>}
                  </span>
                  <span className="mt-0.5 block pl-5 text-xs text-muted">{s.key === "flights" && !trip.request.origin && t.booked?.flights === undefined ? "Add a departure city to estimate flights." : noteFor(s.key, s.note)}</span>
                </td>
                <td className="py-3 text-right font-semibold tabular-nums">{usd(b[s.key])}</td>
                <td className="hidden py-3 text-right text-muted tabular-nums sm:table-cell">{b.total ? Math.round((b[s.key] / b.total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="flex gap-2 text-xs text-muted">
        <Info className="h-4 w-4 shrink-0" />
        <span>
          Estimates use typical prices for your budget tier and update as you edit your itinerary. Live prices on partner sites may differ. Add what you paid to your flights and stays (Itinerary tab, Flights & stays) and the budget uses the real amounts.
          {fx.currency !== "USD" && ` Shown in ${fx.currency} at US$1 = ${fx.rate.toFixed(fx.rate >= 10 ? 1 : 3)} ${fx.currency} (${fx.source === "live" ? "ECB reference rate" : "built-in rate"}${fx.asOf ? `, ${fx.asOf}` : ""}).`}
        </span>
      </p>
    </div>
  );
}

function Stat({ label, value, sub, strong, tone }: { label: string; value: string; sub: string; strong?: boolean; tone?: "good" | "over" }) {
  return (
    <div className={`rounded-2xl border p-5 ${strong ? "border-ink bg-ink text-white" : "border-line bg-surface"}`}>
      <p className={`text-xs font-semibold tracking-wide uppercase ${strong ? "text-white/60" : "text-muted"}`}>{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p>
      <p className={`mt-1 text-sm ${tone === "good" ? "text-sea" : tone === "over" ? "text-brand-dark" : strong ? "text-white/70" : "text-muted"}`}>{sub}</p>
    </div>
  );
}
