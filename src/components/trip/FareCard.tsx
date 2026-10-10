"use client";

import { ExternalLink, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import { airportCode, trackedHref } from "@/lib/booking";
import { formatLocal } from "@/lib/currency";
import { resolveDestination } from "@/lib/curate";
import { formatDate } from "@/lib/dates";
import type { Fare, FareSummary } from "@/lib/fares";
import { tripFx } from "@/lib/money";
import { childAges } from "@/lib/party";
import type { Trip } from "@/lib/types";

/** Seats priced like the budget does: infants ~10%, children ~75%, teens and adults full. */
export function seatShare(trip: Pick<Trip, "request">): number {
  return Math.max(1, trip.request.adults) + childAges(trip.request).reduce((s, a) => s + (a < 2 ? 0.1 : a <= 11 ? 0.75 : 1), 0);
}

/** The route Giro can price: a round trip from a known airport to a single destination. */
export function fareRoute(trip: Trip): { from: string; to: string } | undefined {
  const r = trip.request;
  if (!r.origin.trim() || r.destinations.length !== 1) return undefined;
  const from = airportCode(r.origin);
  const to = resolveDestination(r.destinations[0]).airport ?? airportCode(r.destinations[0]);
  return /^[A-Z]{3}$/.test(from) && /^[A-Z]{3}$/.test(to ?? "") && from !== to ? { from, to: to! } : undefined;
}

/** Fares other travellers found recently for these dates, and a cheaper nearby date if there is one. */
export function FareCard({ trip, readOnly, onUse }: { trip: Trip; readOnly: boolean; onUse: (t: Trip, message: string) => void }) {
  const route = fareRoute(trip);
  const fx = tripFx(trip);
  const { startDate, endDate } = trip.request;
  const [fares, setFares] = useState<FareSummary | null>();

  useEffect(() => {
    if (!route) return;
    let live = true;
    fetch(`/api/fares?${new URLSearchParams({ from: route.from, to: route.to, depart: startDate, return: endDate, cur: fx.currency })}`)
      .then((r) => (r.ok ? r.json() : { fares: null }))
      .then((j: { fares?: FareSummary | null }) => live && setFares(j.fares ?? null))
      .catch(() => live && setFares(null));
    return () => {
      live = false;
    };
  }, [route?.from, route?.to, startDate, endDate, fx.currency]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!route || !fares || (!fares.exact && !fares.nearby)) return null;
  const seats = seatShare(trip);
  const paidFlights = (trip.flights ?? []).some((f) => f.paid);
  const fmt = (n: number) => formatLocal(n, fx.currency);
  const link = (f: Fare) => (f.url ? trackedHref({ url: f.url, provider: "Aviasales", kind: "flights", valueUSD: (f.price * seats) / (fx.rate || 1) }, trip.id) : undefined);
  const stops = (f: Fare) => (f.transfers === undefined ? "" : f.transfers === 0 ? " · nonstop" : ` · ${f.transfers} stop${f.transfers > 1 ? "s" : ""}`);
  const using = trip.fareQuote && trip.fareQuote.from === route.from && trip.fareQuote.to === route.to;

  const use = (f: Fare) =>
    onUse(
      { ...trip, fareQuote: { perAdultUSD: Math.round((f.price / (fx.rate || 1)) * 100) / 100, seenAt: new Date().toISOString().slice(0, 10), from: route.from, to: route.to, airline: f.airline } },
      `Flight estimate now uses the ${fmt(f.price)} fare.`,
    );

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">Fares seen recently · {route.from} ⇄ {route.to}</p>
      {fares.exact ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm">
            <span className="text-2xl font-semibold">{fmt(fares.exact.price)}</span> <span className="text-muted">return per adult{fares.exact.airline ? ` · ${fares.exact.airline}` : ""}{stops(fares.exact)}</span>
            {seats > 1 && <span className="block text-sm text-ink-soft">About {fmt(Math.round(fares.exact.price * seats))} for your group</span>}
          </p>
          <span className="ml-auto flex flex-wrap gap-2">
            {link(fares.exact) && <a href={link(fares.exact)} target="_blank" rel="noopener noreferrer sponsored" className="btn-dark px-3.5 py-2 text-xs">See this fare <ExternalLink className="h-3 w-3" /></a>}
            {!readOnly && !paidFlights && !using && <button type="button" className="btn-ghost px-3.5 py-2 text-xs" onClick={() => use(fares.exact!)}>Use as flight estimate</button>}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">No recent fares for your exact dates.</p>
      )}
      {fares.nearby && (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-sea-soft px-3 py-2 text-sm text-ink-soft">
          <TrendingDown className="h-4 w-4 text-sea" aria-hidden="true" />
          <span>
            <span className="font-semibold text-sea">Fly {formatDate(fares.nearby.departDate, { month: "short", day: "numeric" })} – {formatDate(fares.nearby.returnDate!, { month: "short", day: "numeric" })} instead: {fmt(fares.nearby.price)}</span>
            {fares.exact && ` (save about ${fmt(Math.round((fares.exact.price - fares.nearby.price) * seats))} for your group)`}
          </span>
          {link(fares.nearby) && <a href={link(fares.nearby)} target="_blank" rel="noopener noreferrer sponsored" className="ml-auto font-semibold text-ink underline-offset-2 hover:underline">See it</a>}
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        {using ? `Your budget uses a ${route.from}–${route.to} fare seen ${formatDate(trip.fareQuote!.seenAt, { month: "short", day: "numeric" })}. ` : ""}
        Prices other travellers found in the last few days (via Aviasales). The fare when you book may differ.
      </p>
    </div>
  );
}
