"use client";

import { ArrowRight, Leaf, Plane, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CURRENCIES, currencySymbol, formatLocal, type Currency, type FxSnapshot } from "@/lib/currency";
import { addDays, toISODate } from "@/lib/dates";
import { discover, type DiscoverResult } from "@/lib/discover";
import { getFx } from "@/lib/plan-client";
import { loadTaste } from "@/lib/taste-client";
import { INTERESTS, type Interest } from "@/lib/types";
import { Stepper } from "./controls";
import { BUDGET_META, INTEREST_META } from "./meta";
import { useSession } from "./SessionProvider";

export function DiscoverView() {
  const { user } = useSession();
  const [currency, setCurrency] = useState<Currency>("CAD");
  const [fx, setFx] = useState<FxSnapshot>();
  const [budget, setBudget] = useState(4000);
  const [origin, setOrigin] = useState("Toronto");
  const [start, setStart] = useState("");
  const [nights, setNights] = useState(6);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [interests, setInterests] = useState<Interest[]>(["food", "culture"]);

  useEffect(() => {
    setStart(addDays(toISODate(new Date()), 45));
  }, []);
  useEffect(() => {
    if (!user) return;
    setCurrency(user.homeCurrency);
    if (user.homeAirport) setOrigin(user.homeAirport);
  }, [user]);
  useEffect(() => {
    getFx(currency).then(setFx);
  }, [currency]);

  const results = useMemo(() => {
    if (!fx || !start || !(budget > 0)) return undefined;
    return discover({ budget, fx, origin, startDate: start, nights, adults, children, interests, taste: loadTaste() });
  }, [budget, fx, origin, start, nights, adults, children, interests]);

  const planHref = (r: DiscoverResult) => {
    const p = new URLSearchParams({
      to: r.destination.name,
      from: origin,
      start,
      end: addDays(start, nights),
      adults: String(adults),
      children: String(children),
      interests: interests.join(","),
      cur: currency,
      budget: String(budget),
      tier: r.tier,
      mode: "advanced",
    });
    return `/plan?${p.toString()}`;
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <aside className="card h-fit space-y-5 p-5 lg:sticky lg:top-24">
        <div>
          <label className="label" htmlFor="d-budget">Total budget</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-muted">{currencySymbol(currency)}</span>
              <input id="d-budget" inputMode="numeric" className="field pl-10 text-lg font-semibold" value={budget ? budget.toLocaleString("en-CA") : ""} onChange={(e) => setBudget(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} />
            </div>
            <select aria-label="Currency" className="field w-24 px-3" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input type="range" aria-label="Budget slider" min={1000} max={20000} step={250} value={Math.min(20000, Math.max(1000, budget))} onChange={(e) => setBudget(Number(e.target.value))} className="mt-3 w-full accent-[var(--color-brand)]" />
        </div>
        <div>
          <label className="label" htmlFor="d-origin">Flying from</label>
          <div className="relative">
            <Plane className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" />
            <input id="d-origin" className="field pl-11" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="City or airport code" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="d-start">Leaving</label>
            <input id="d-start" type="date" className="field px-3" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="d-nights">Nights</label>
            <input id="d-nights" type="number" min={2} max={21} className="field px-3" value={nights} onChange={(e) => setNights(Math.max(2, Math.min(21, Number(e.target.value) || 2)))} />
          </div>
        </div>
        <Stepper label="Adults" value={adults} min={1} max={10} onChange={setAdults} />
        <Stepper label="Children" value={children} min={0} max={8} onChange={setChildren} />
        <div>
          <p className="label">Into</p>
          <div className="flex flex-wrap gap-1.5">
            {INTERESTS.map((i) => {
              const { label, icon: Icon } = INTEREST_META[i];
              const on = interests.includes(i);
              return (
                <button key={i} type="button" className="chip px-2.5 py-1.5 text-xs" aria-pressed={on} onClick={() => setInterests(on ? interests.filter((x) => x !== i) : [...interests, i])}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <div>
        {!results ? (
          <div className="h-96 animate-pulse rounded-3xl bg-sand" />
        ) : results.fits.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <Search className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 font-display text-2xl font-semibold">Nothing fits quite yet</p>
            <p className="mt-1 text-muted">Try fewer nights, a later date, or a slightly bigger budget.</p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              <span className="font-semibold text-ink">{results.fits.length} destinations</span> fit {formatLocal(budget, currency)} for {adults + children} traveller{adults + children > 1 ? "s" : ""}, {nights} nights, including flights from {origin || "home"}.
            </p>
            <ul className="grid gap-4 sm:grid-cols-2">
              {results.fits.map((r) => <ResultCard key={r.destination.slug} r={r} currency={currency} fx={fx!} href={planHref(r)} />)}
            </ul>
          </>
        )}
        {results && results.stretch.length > 0 && (
          <div className="mt-10">
            <h2 className="font-semibold">Just out of reach</h2>
            <p className="text-sm text-muted">Within 15% of your budget on a shoestring.</p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {results.stretch.map((r) => <ResultCard key={r.destination.slug} r={r} currency={currency} fx={fx!} href={planHref(r)} />)}
            </ul>
          </div>
        )}
        <p className="mt-8 text-xs text-muted">Estimates use typical fares by distance and typical prices for each budget level. Book soon after searching, because live prices move.</p>
      </div>
    </div>
  );
}

function ResultCard({ r, currency, fx, href }: { r: DiscoverResult; currency: Currency; fx: FxSnapshot; href: string }) {
  const [a, b] = r.destination.palette;
  const local = (usd: number) => formatLocal(usd * fx.rate, currency);
  return (
    <li>
      <Link href={href} className="card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
        <div className="relative p-5 text-white" style={{ background: `linear-gradient(150deg, ${a}, ${b} 140%)` }}>
          <span className="bg-grain absolute inset-0 opacity-40 mix-blend-overlay" />
          <span className="relative flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <span className="rounded-full bg-white/20 px-2 py-0.5 backdrop-blur">{BUDGET_META[r.tier].symbol} {BUDGET_META[r.tier].label}</span>
            {r.inSeason && <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 backdrop-blur"><Leaf className="h-3 w-3" /> Great season</span>}
          </span>
          <p className="relative mt-3 text-xs font-semibold tracking-[0.14em] text-white/70 uppercase">{r.destination.country}</p>
          <p className="relative font-display text-2xl font-semibold">{r.destination.name}</p>
        </div>
        <div className="p-5">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl font-semibold tabular-nums">{formatLocal(r.total, currency, { approx: true })}</span>
            <span className={`text-sm font-semibold ${r.headroom >= 0 ? "text-sea" : "text-brand-dark"}`}>
              {r.headroom >= 0 ? `${formatLocal(r.headroom, currency)} to spare` : `${formatLocal(-r.headroom, currency)} over`}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">Flights {local(r.budget.flights)} · Stay {local(r.budget.lodging)} · Daily {local(r.budget.food + r.budget.localTransport + r.budget.activities)}</p>
          <p className="mt-4 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted"><Sparkles className="h-3.5 w-3.5" /> {r.interestMatches} matching experiences</span>
            <span className="inline-flex items-center gap-1 font-semibold text-brand">Plan it <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
          </p>
        </div>
      </Link>
    </li>
  );
}
