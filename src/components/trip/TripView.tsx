"use client";

import { CalendarDays, Check, Copy, Link2, Pencil, Printer, RefreshCw, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { curateTrip, recalcBudget } from "@/lib/curate";
import { formatDate, formatRange } from "@/lib/dates";
import { downloadFile, encodeTrip, tripToICS, tripToText } from "@/lib/export";
import { planTrip } from "@/lib/plan-client";
import { deleteTrip, loadTrip, saveTrip } from "@/lib/storage";
import type { Day, Trip } from "@/lib/types";
import { BUDGET_META, PACE_META } from "../meta";
import { BookPanel } from "./BookPanel";
import { BudgetPanel } from "./BudgetPanel";
import { DayPlan } from "./DayPlan";
import { PackingPanel } from "./PackingPanel";

const TABS = [
  { id: "itinerary", label: "Itinerary" },
  { id: "book", label: "Book" },
  { id: "budget", label: "Budget" },
  { id: "packing", label: "Packing & tips" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const NOTICES: Record<string, string> = {
  "ai-unavailable": "Giro AI isn't available right now, so this trip was curated instantly by the Giro engine.",
  "ai-failed": "Giro AI couldn't finish this one, so the Giro engine stepped in. You can try AI again with Regenerate.",
};

export function editUrl(trip: Trip): string {
  const r = trip.request;
  const p = new URLSearchParams({
    to: r.destinations.join("|"),
    from: r.origin,
    start: r.startDate,
    end: r.endDate,
    adults: String(r.adults),
    children: String(r.children),
    interests: r.interests.join(","),
  });
  if (r.destinations.length > 1) p.set("mode", "advanced");
  return `/plan?${p.toString()}`;
}

export function TripView() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>();
  const [tab, setTab] = useState<Tab>("itinerary");
  const [copied, setCopied] = useState<"text" | "link">();
  const [regenerating, setRegenerating] = useState(false);
  const notice = search.get("notice");

  useEffect(() => {
    setTrip(loadTrip(id) ?? null);
    window.scrollTo(0, 0);
  }, [id]);

  const commit = useCallback((next: Trip) => {
    setTrip(next);
    saveTrip(next);
  }, []);

  if (trip === undefined) return <div className="mx-auto h-[60vh] max-w-6xl animate-pulse px-4 py-10 sm:px-6"><div className="h-64 rounded-3xl bg-sand" /></div>;
  if (trip === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold">Trip not found</h1>
        <p className="mt-2 text-muted">Trips are saved in this browser. It may have been deleted or planned on another device.</p>
        <Link href="/plan" className="btn-primary mt-6">Plan a new trip</Link>
      </div>
    );
  }

  const r = trip.request;
  const updateDay = (day: Day) => commit(recalcBudget({ ...trip, days: trip.days.map((d) => (d.index === day.index ? day : d)) }));

  async function regenerate() {
    if (!trip) return;
    setRegenerating(true);
    let fresh: Trip;
    if (r.useAI) {
      const res = await planTrip(r);
      if (res.trip.id !== trip.id) deleteTrip(res.trip.id);
      fresh = res.trip;
    } else {
      fresh = curateTrip(r);
    }
    commit({ ...fresh, id: trip.id, createdAt: trip.createdAt });
    setRegenerating(false);
  }

  async function copy(kind: "text" | "link") {
    if (!trip) return;
    try {
      const value = kind === "text" ? tripToText(trip) : `${window.location.origin}/shared#${await encodeTrip(trip)}`;
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(undefined), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  const people = r.adults + r.children;
  const [c1, c2] = trip.palette;

  return (
    <div>
      <section className="relative overflow-hidden text-white" style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 120%)` }}>
        <div className="bg-grain absolute inset-0 opacity-40 mix-blend-overlay" />
        <div className="absolute -right-24 -bottom-40 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-10 sm:px-6 sm:pt-16">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
              {trip.source === "ai" ? <><Sparkles className="h-3.5 w-3.5" /> Curated by Giro AI</> : "Curated by Giro"}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">{formatRange(r.startDate, r.endDate)}</span>
          </div>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">{trip.title}</h1>
          <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">{trip.summary}</p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            <span>{people} traveller{people > 1 ? "s" : ""}</span>
            <span>{trip.days.length} days</span>
            <span>{PACE_META[r.pace].label} pace</span>
            <span>{BUDGET_META[r.budgetTier].label}</span>
            <span className="font-semibold text-white">~${trip.budget.total.toLocaleString("en-US")} total</span>
          </div>
          <div className="no-print mt-8 flex flex-wrap gap-2">
            <HeroBtn onClick={() => downloadFile(`${slug(trip.title)}.ics`, tripToICS(trip), "text/calendar")}><CalendarDays className="h-4 w-4" /> Add to calendar</HeroBtn>
            <HeroBtn onClick={() => copy("link")}>{copied === "link" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} {copied === "link" ? "Link copied" : "Share link"}</HeroBtn>
            <HeroBtn onClick={() => copy("text")}>{copied === "text" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === "text" ? "Copied" : "Copy as text"}</HeroBtn>
            <HeroBtn onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / PDF</HeroBtn>
            <HeroBtn onClick={regenerate} disabled={regenerating}><RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} /> {regenerating ? "Re-curating…" : "Regenerate"}</HeroBtn>
            <Link href={editUrl(trip)} className="btn border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20"><Pencil className="h-4 w-4" /> Edit details</Link>
            <HeroBtn
              onClick={() => {
                if (confirm("Delete this trip? This can't be undone.")) {
                  deleteTrip(trip.id);
                  router.push("/trips");
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete trip</span>
            </HeroBtn>
          </div>
        </div>
      </section>

      {notice && NOTICES[notice] && (
        <div className="no-print mx-auto mt-6 max-w-6xl px-4 sm:px-6">
          <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {NOTICES[notice]}
          </p>
        </div>
      )}

      <div className="no-print sticky top-16 z-30 border-b border-line bg-paper/85 backdrop-blur-xl">
        <div role="tablist" aria-label="Trip sections" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`relative shrink-0 px-4 py-4 text-sm font-semibold transition ${tab === t.id ? "text-ink" : "text-muted hover:text-ink"}`}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {tab === "itinerary" && (
          <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
            <nav aria-label="Days" className="no-print hidden lg:block">
              <ol className="sticky top-36 space-y-1">
                {trip.days.map((d) => (
                  <li key={d.index}>
                    <a href={`#day-${d.index + 1}`} className="block rounded-xl px-3 py-2 transition hover:bg-sand">
                      <span className="block text-xs font-semibold text-muted">Day {d.index + 1} · {formatDate(d.date, { month: "short", day: "numeric" })}</span>
                      <span className="block truncate text-sm font-medium">{d.theme}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="space-y-14">
              <StaySummary trip={trip} />
              {trip.days.map((d) => (
                <DayPlan key={d.index} trip={trip} day={d} onChange={updateDay} />
              ))}
            </div>
          </div>
        )}
        {tab === "book" && <BookPanel trip={trip} />}
        {tab === "budget" && <BudgetPanel trip={trip} />}
        {tab === "packing" && <PackingPanel trip={trip} onChange={commit} />}
      </div>
    </div>
  );
}

function StaySummary({ trip }: { trip: Trip }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {trip.stays.map((s) => (
        <div key={s.city + s.checkIn} className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Base · {s.nights} night{s.nights > 1 ? "s" : ""} in {s.city}</p>
          <p className="mt-1 font-semibold">{s.area}</p>
          <p className="mt-0.5 text-sm text-ink-soft">{s.why}</p>
        </div>
      ))}
    </div>
  );
}

function HeroBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20">
      {children}
    </button>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "giro-trip";
