"use client";

import { ArrowRight, CalendarDays, LoaderCircle, MapPin, PencilRuler, Plane, Plus, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { addDays, formatRange, isValidISODate, nightsBetween, toISODate } from "@/lib/dates";
import { CURRENCIES, CURRENCY_NAMES, DEFAULT_CURRENCY, currencySymbol, isCurrency } from "@/lib/currency";
import { DESTINATIONS, findDestination } from "@/lib/destinations";
import { checkAI, planBlank, planTrip } from "@/lib/plan-client";
import { ACCESS_LABELS, ACCESS_NEEDS, isAccessNeed, type AccessNeed } from "@/lib/access";
import { ageLabel, describeParty, MAX_CHILD_AGE, normalizeChildAges } from "@/lib/party";
import { topInterests } from "@/lib/taste";
import { loadTaste } from "@/lib/taste-client";
import { BUDGET_TIERS, INTERESTS, PACES, STAY_TYPES, type Interest, type TripRequest } from "@/lib/types";
import { Segmented, Stepper, Toggle } from "./controls";
import { useSession } from "./SessionProvider";
import { BUDGET_META, INTEREST_META, PACE_META, STAY_META } from "./meta";

const LOADING_LINES = [
  "Reading the map…",
  "Clustering neighbourhoods so you walk less…",
  "Balancing big sights with slow moments…",
  "Checking which tickets sell out…",
  "Finding where locals actually eat…",
];

const INTEREST_SET = new Set<string>(INTERESTS);

function initialRequest(params: URLSearchParams): TripRequest {
  const interests = (params.get("interests") ?? "").split(",").filter((i): i is Interest => INTEREST_SET.has(i));
  const to = (params.get("to") ?? "").split("|").map((d) => d.trim()).filter(Boolean).slice(0, 6);
  const num = (k: string, d: number) => {
    const n = Number(params.get(k));
    return Number.isFinite(n) && params.has(k) ? n : d;
  };
  return {
    destinations: to.length ? to : [""],
    origin: params.get("from") ?? "",
    startDate: params.get("start") ?? "",
    endDate: params.get("end") ?? "",
    adults: Math.max(1, num("adults", 2)),
    children: Math.max(0, num("children", 0)),
    budgetTier: (BUDGET_TIERS as readonly string[]).includes(params.get("tier") ?? "") ? (params.get("tier") as TripRequest["budgetTier"]) : "comfort",
    currency: isCurrency(params.get("cur")) ? (params.get("cur") as TripRequest["currency"]) : DEFAULT_CURRENCY,
    totalBudget: num("budget", 0) > 0 ? num("budget", 0) : undefined,
    pace: "balanced",
    interests: interests.length ? interests : ["culture", "food"],
    stayType: "hotel",
    access: (params.get("access") ?? "").split(",").filter(isAccessNeed),
    avoid: params.get("avoid")?.slice(0, 500) || undefined,
    notes: params.get("notes")?.slice(0, 1000) || undefined,
    mustSee: params.get("must")?.slice(0, 500) || undefined,
    useAI: false,
  };
}

export function Planner() {
  const router = useRouter();
  const params = useSearchParams();
  const [req, setReq] = useState<TripRequest>(() => initialRequest(new URLSearchParams(params.toString())));
  const [advanced, setAdvanced] = useState(params.get("mode") === "advanced");
  // One entry per child; "" until an age is picked. Kept apart from `req` so blanks don't shift ages.
  const [ages, setAges] = useState<string[]>(() => {
    const given = (params.get("ages") ?? "").split(",").filter((a) => a !== "" && Number.isFinite(Number(a)));
    return Array.from({ length: Math.max(0, Number(params.get("children")) || 0) }, (_, i) => given[i] ?? "");
  });
  const [aiReady, setAiReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState(0);
  const [error, setError] = useState<string>();
  const [today, setToday] = useState<string>();
  const [tuned, setTuned] = useState(false);
  const { user } = useSession();

  // Signed-in travellers start from their home currency and airport (unless the link says otherwise).
  useEffect(() => {
    if (!user) return;
    setReq((r) => ({
      ...r,
      currency: params.has("cur") ? r.currency : user.homeCurrency,
      origin: r.origin || user.homeAirport,
    }));
  }, [user, params]);

  const set = <K extends keyof TripRequest>(key: K, value: TripRequest[K]) => setReq((r) => ({ ...r, [key]: value }));
  const setChildren = (n: number) => {
    set("children", n);
    setAges((a) => Array.from({ length: n }, (_, i) => a[i] ?? ""));
  };
  const childAges = normalizeChildAges(req.children, ages.filter((a) => a !== "").map(Number));

  // Default dates are set on the client so prerendered HTML never carries a stale date.
  useEffect(() => {
    setToday(toISODate(new Date()));
    setReq((r) => {
      if (r.startDate && r.endDate) return r;
      const start = r.startDate || addDays(toISODate(new Date()), 30);
      // Guides link here with a length ("nights") rather than dates.
      const nights = Math.min(29, Math.max(1, Number(params.get("nights")) || 5));
      return { ...r, startDate: start, endDate: r.endDate || addDays(start, nights) };
    });
    // Start from the traveller's learned favourites when the link doesn't specify interests.
    const learned = topInterests(loadTaste(), 3);
    if (!params.has("interests") && learned.length) {
      setReq((r) => ({ ...r, interests: learned }));
      setTuned(true);
    }
    checkAI().then((ok) => {
      setAiReady(ok);
      if (ok) setReq((r) => ({ ...r, useAI: true }));
    });
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setLine((l) => (l + 1) % LOADING_LINES.length), 1800);
    return () => clearInterval(t);
  }, [busy]);

  const nights = req.startDate && req.endDate ? nightsBetween(req.startDate, req.endDate) : 0;
  const cities = req.destinations.map((d) => d.trim()).filter(Boolean);
  const known = cities.map((c) => findDestination(c));

  const problem = useMemo(() => {
    if (!cities.length) return "Where are you headed?";
    if (!isValidISODate(req.startDate) || !isValidISODate(req.endDate)) return "Pick your travel dates.";
    if (nights < 1) return "Your return date needs to be after you leave.";
    if (nights > 29) return "Giro plans trips of up to 29 nights. Try splitting a longer journey into two trips.";
    if (cities.length > nights) return `${cities.length} cities need at least ${cities.length} nights.`;
    return undefined;
  }, [cities.length, req.startDate, req.endDate, nights]);

  const toggleAccess = (n: AccessNeed) =>
    set("access", req.access?.includes(n) ? req.access.filter((x) => x !== n) : [...(req.access ?? []), n]);

  const toggleInterest = (i: Interest) =>
    set("interests", req.interests.includes(i) ? req.interests.filter((x) => x !== i) : [...req.interests, i]);

  async function startBlank() {
    if (problem) return setError(problem);
    setError(undefined);
    setBusy(true);
    const trip = await planBlank({ ...req, childAges, destinations: advanced ? cities : cities.slice(0, 1), useAI: false, mustSee: advanced ? req.mustSee : undefined, totalBudget: advanced ? req.totalBudget : undefined });
    router.push(`/trip/${trip.id}`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problem) {
      setError(problem);
      return;
    }
    setError(undefined);
    setBusy(true);
    const destinations = advanced ? cities : cities.slice(0, 1);
    const payload: TripRequest = {
      ...req,
      childAges,
      destinations,
      ...(advanced ? {} : { mustSee: undefined, totalBudget: undefined }),
      avoid: req.avoid?.trim() || undefined,
      notes: req.notes?.trim() || undefined,
      useAI: aiReady && req.useAI,
    };
    const { trip, notice } = await planTrip(payload);
    router.push(`/trip/${trip.id}${notice ? `?notice=${notice}` : ""}`);
  }

  if (busy) {
    return (
      <div className="card mx-auto flex max-w-xl flex-col items-center gap-5 px-6 py-16 text-center">
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-brand text-white">
            <Sparkles className="h-7 w-7" />
          </span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold">Curating {cities[0] ?? "your trip"}</h2>
          <p className="mt-2 text-muted" aria-live="polite">{LOADING_LINES[line]}</p>
          {req.useAI && aiReady && <p className="mt-4 text-xs text-muted">Giro AI is hand-picking places. This can take up to a minute.</p>}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_340px]" noValidate>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div role="tablist" aria-label="Planner mode" className="inline-flex rounded-full border border-line bg-surface p-1">
            {[
              { v: false, label: "Simple" },
              { v: true, label: "Advanced" },
            ].map((m) => (
              <button key={m.label} type="button" role="tab" aria-selected={advanced === m.v} onClick={() => setAdvanced(m.v)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${advanced === m.v ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="hidden text-sm text-muted sm:block">{advanced ? "Multi-city, budgets and fine-tuning." : "Five questions. One great trip."}</p>
        </div>

        <Section n={1} title="Where to?">
          <datalist id="giro-destinations">
            {DESTINATIONS.map((d) => (
              <option key={d.slug} value={d.name}>{d.country}</option>
            ))}
          </datalist>
          <div className="space-y-3">
            {(advanced ? req.destinations : req.destinations.slice(0, 1)).map((city, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <MapPin className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    className="field pl-11"
                    list="giro-destinations"
                    placeholder={i === 0 ? "City or region, e.g. Lisbon" : "Next stop"}
                    value={city}
                    aria-label={i === 0 ? "Destination" : `Stop ${i + 1}`}
                    autoFocus={i === 0 && !city}
                    onChange={(e) => set("destinations", req.destinations.map((d, j) => (j === i ? e.target.value : d)))}
                  />
                </div>
                {advanced && req.destinations.length > 1 && (
                  <button type="button" aria-label={`Remove stop ${i + 1}`} className="grid h-11 w-11 place-items-center rounded-xl border border-line text-muted hover:text-ink" onClick={() => set("destinations", req.destinations.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {advanced && req.destinations.length < 6 && (
              <button type="button" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark" onClick={() => set("destinations", [...req.destinations, ""])}>
                <Plus className="h-4 w-4" /> Add another city
              </button>
            )}
          </div>
          <div className="mt-4">
            <label className="label" htmlFor="origin">Flying from <span className="font-normal normal-case">(optional, for flight search)</span></label>
            <div className="relative">
              <Plane className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" />
              <input id="origin" className="field pl-11" placeholder="City or airport code, e.g. JFK" value={req.origin} onChange={(e) => set("origin", e.target.value)} />
            </div>
          </div>
        </Section>

        <Section n={2} title="When?">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="start">Depart</label>
              <input id="start" type="date" className="field" value={req.startDate} min={today} onChange={(e) => {
                const start = e.target.value;
                setReq((r) => ({ ...r, startDate: start, endDate: r.endDate && r.endDate > start ? r.endDate : start ? addDays(start, 5) : r.endDate }));
              }} />
            </div>
            <div>
              <label className="label" htmlFor="end">Return</label>
              <input id="end" type="date" className="field" value={req.endDate} min={req.startDate ? addDays(req.startDate, 1) : undefined} onChange={(e) => set("endDate", e.target.value)} />
            </div>
          </div>
        </Section>

        <Section n={3} title="Who's going?">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stepper label="Adults" value={req.adults} min={1} max={16} onChange={(v) => set("adults", v)} />
            <Stepper label="Children" hint="Under 18" value={req.children} min={0} max={10} onChange={setChildren} />
          </div>
          {req.children > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium">Children&apos;s ages</p>
              <p className="text-xs text-muted">So we pick stops that suit them and partner sites show the right fares.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ages.map((age, i) => (
                  <select key={i} aria-label={`Age of child ${i + 1}`} className="field w-auto py-2" value={age} onChange={(e) => setAges((a) => a.map((x, j) => (j === i ? e.target.value : x)))}>
                    <option value="">Child {i + 1}: age?</option>
                    {Array.from({ length: MAX_CHILD_AGE + 1 }, (_, n) => (
                      <option key={n} value={n}>{n === 0 ? "Under 1" : `${ageLabel(n)} year${n === 1 ? "" : "s"}`}</option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section n={4} title="What do you love?">
          {tuned && <p className="-mt-2 mb-3 text-xs text-sea">Pre-selected from your travel DNA. Change anything you like.</p>}
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const { label, icon: Icon } = INTEREST_META[i];
              return (
                <button key={i} type="button" className="chip" aria-pressed={req.interests.includes(i)} onClick={() => toggleInterest(i)}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section n={5} title="Budget">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Prices shown in</p>
            <select aria-label="Currency" className="field w-auto py-2" value={req.currency} onChange={(e) => set("currency", e.target.value as TripRequest["currency"])}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c} · {CURRENCY_NAMES[c]}</option>
              ))}
            </select>
          </div>
          <Segmented ariaLabel="Budget tier" value={req.budgetTier} onChange={(v) => set("budgetTier", v)} options={BUDGET_TIERS.map((b) => ({ value: b, label: `${BUDGET_META[b].symbol} ${BUDGET_META[b].label}`, hint: BUDGET_META[b].hint }))} />
        </Section>

        <Section n={6} title="Anything to plan around?">
          <div className="grid gap-4">
            <div>
              <p className="label">Getting around</p>
              <div className="flex flex-wrap gap-2">
                {ACCESS_NEEDS.map((n) => (
                  <button key={n} type="button" className="chip" aria-pressed={req.access?.includes(n) ?? false} title={ACCESS_LABELS[n].hint} onClick={() => toggleAccess(n)}>
                    {ACCESS_LABELS[n].label}
                  </button>
                ))}
              </div>
              {req.access?.length ? <p className="mt-1.5 text-xs text-muted">We leave out hikes, climbs and stops with lots of stairs. Lifts and step-free routes change, so check with each venue.</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="avoid">Skip</label>
              <input id="avoid" className="field" placeholder="e.g. museums, early starts, nightlife" value={req.avoid ?? ""} onChange={(e) => set("avoid", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="notes">Notes</label>
              <textarea id="notes" rows={3} className="field resize-none" placeholder="Honeymoon, vegetarian, celebrating a birthday…" value={req.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              <p className="mt-1.5 text-xs text-muted">{aiReady && req.useAI ? "Giro AI reads your notes as it plans." : "Saved with your trip. Giro AI reads them when it's on; the instant planner uses Skip and the options above."}</p>
            </div>
          </div>
        </Section>

        {advanced && (
          <>
            <Section n={7} title="Pace & stay" icon={<SlidersHorizontal className="h-4 w-4" />}>
              <Segmented ariaLabel="Pace" value={req.pace} onChange={(v) => set("pace", v)} options={PACES.map((p) => ({ value: p, label: PACE_META[p].label, hint: PACE_META[p].hint }))} />
              <p className="label mt-5">Where you like to stay</p>
              <div className="flex flex-wrap gap-2">
                {STAY_TYPES.map((s) => (
                  <button key={s} type="button" className="chip" aria-pressed={req.stayType === s} onClick={() => set("stayType", s)}>
                    {STAY_META[s].label}
                  </button>
                ))}
              </div>
            </Section>

            <Section n={8} title="Fine-tune">
              <div className="grid gap-4">
                <div>
                  <label className="label" htmlFor="budget">Total budget for the group ({req.currency ?? DEFAULT_CURRENCY})</label>
                  <input id="budget" inputMode="numeric" className="field" placeholder={`e.g. ${currencySymbol(req.currency ?? DEFAULT_CURRENCY)}5,000`} value={req.totalBudget ?? ""} onChange={(e) => {
                    const n = Number(e.target.value.replace(/[^0-9]/g, ""));
                    set("totalBudget", n > 0 ? n : undefined);
                  }} />
                </div>
                <div>
                  <label className="label" htmlFor="must">Must-sees</label>
                  <input id="must" className="field" placeholder="Comma-separated, e.g. Sintra, a fado night" value={req.mustSee ?? ""} onChange={(e) => set("mustSee", e.target.value)} />
                </div>
              </div>
            </Section>
          </>
        )}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card overflow-hidden">
          <div className="bg-ink px-6 py-5 text-white">
            <p className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">Your trip</p>
            <p className="mt-1 font-display text-2xl font-semibold">{cities.length ? (advanced ? cities.join(" → ") : cities[0]) : "Somewhere wonderful"}</p>
            <p className="mt-1 text-sm text-white/70">
              {req.startDate && req.endDate && nights > 0 ? `${formatRange(req.startDate, req.endDate)} · ${nights} night${nights > 1 ? "s" : ""}` : "Pick dates"}
            </p>
          </div>
          <dl className="space-y-3 px-6 py-5 text-sm">
            <Row k="Travellers" v={describeParty({ ...req, childAges })} />
            <Row k="Budget" v={BUDGET_META[req.budgetTier].label} />
            <Row k="Pace" v={PACE_META[req.pace].label} />
            <Row k="Into" v={req.interests.length ? req.interests.map((i) => INTEREST_META[i].label).join(", ") : "Everything"} />
          </dl>
          {cities.length > 0 && known.some((k) => !k) && (
            <p className="mx-6 mb-4 rounded-xl bg-sand px-3 py-2 text-xs text-ink-soft">
              {aiReady ? "Giro AI will research this destination for you." : "We'll build a flexible framework for this destination. Add must-sees to personalise it."}
            </p>
          )}
          <div className="border-t border-line px-6 py-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-brand" /> Giro AI</p>
                <p className="text-xs text-muted">{aiReady ? "Claude hand-picks real places for you." : "Not configured on this server. Using the instant Giro engine."}</p>
              </div>
              <Toggle label="Use Giro AI" checked={aiReady && Boolean(req.useAI)} disabled={!aiReady} onChange={(v) => set("useAI", v)} />
            </div>
            {error && <p role="alert" className="mb-3 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-dark">{error}</p>}
            <button type="submit" className="btn-primary w-full py-3.5 text-base" disabled={busy}>
              {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <CalendarDays className="h-5 w-5" />}
              Curate my trip
              <ArrowRight className="h-4 w-4" />
            </button>
            <button type="button" className="btn-ghost mt-2 w-full py-2.5 text-sm" disabled={busy} onClick={startBlank}>
              <PencilRuler className="h-4 w-4" /> Start from scratch
            </button>
            <p className="mt-1.5 text-center text-xs text-muted">Empty days with your dates, cities and travel days. Fill them from Ideas or your own stops.</p>
          </div>
        </div>
      </aside>
    </form>
  );
}

function Section({ n, title, icon, children }: { n: number; title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-sand text-xs font-bold text-ink-soft">{icon ?? n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
