"use client";

import { ArrowRight, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRange } from "@/lib/dates";
import { loadTrips } from "@/lib/storage";
import type { Trip } from "@/lib/types";

export function TripList() {
  const [trips, setTrips] = useState<Trip[]>();
  useEffect(() => setTrips(loadTrips()), []);

  if (!trips) return <div className="h-48 animate-pulse rounded-3xl bg-sand" />;
  if (!trips.length) {
    return (
      <div className="card flex flex-col items-center px-6 py-16 text-center">
        <p className="font-display text-2xl font-semibold">No trips yet</p>
        <p className="mt-2 text-muted">Your curated itineraries will live here.</p>
        <Link href="/plan" className="btn-primary mt-6"><Plus className="h-4 w-4" /> Plan your first trip</Link>
      </div>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((t) => (
        <li key={t.id}>
          <Link href={`/trip/${t.id}`} className="card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
            <div className="relative h-28 p-4 text-white" style={{ background: `linear-gradient(135deg, ${t.palette[0]}, ${t.palette[1]} 140%)` }}>
              <span className="bg-grain absolute inset-0 opacity-40 mix-blend-overlay" />
              {t.source === "ai" && <span className="relative inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur"><Sparkles className="h-3 w-3" /> Giro AI</span>}
            </div>
            <div className="p-5">
              <p className="font-display text-xl font-semibold">{t.title}</p>
              <p className="mt-1 text-sm text-muted">{formatRange(t.request.startDate, t.request.endDate)} · {t.request.adults + t.request.children} travellers</p>
              <p className="mt-4 flex items-center justify-between text-sm">
                <span className="font-semibold">~${t.budget.total.toLocaleString("en-US")}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-brand">Open <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
