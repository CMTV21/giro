import type { Metadata } from "next";
import Link from "next/link";
import { DESTINATIONS, type Region } from "@/lib/destinations";
import { guideLengths, guidePath, monthsLabel } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Trip guides: day-by-day itineraries for 26 cities",
  description: "Free day-by-day itineraries for 3, 5 and 7 days in 26 cities, with timed stops, maps, where to stay, what to eat and what to steer clear of. Make any of them your own in one click.",
  alternates: { canonical: "/guides" },
};

const REGIONS: { id: Region; label: string }[] = [
  { id: "europe", label: "Europe" },
  { id: "north-america", label: "North America" },
  { id: "latin-america", label: "Mexico and the Caribbean" },
  { id: "east-asia", label: "East Asia" },
  { id: "southeast-asia", label: "Southeast Asia" },
  { id: "middle-east", label: "Middle East and Türkiye" },
  { id: "africa", label: "Africa" },
  { id: "oceania", label: "Oceania" },
];

export default function GuidesIndex() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="eyebrow">Trip guides</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Day-by-day itineraries, ready to make yours</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">Each guide plans every day by neighbourhood with real times, then adds where to stay, what to eat and what to watch out for. Like one? Make it yours with your dates in a click.</p>
      {REGIONS.map((r) => {
        const cities = DESTINATIONS.filter((d) => d.region === r.id);
        if (!cities.length) return null;
        return (
          <section key={r.id} className="mt-12" aria-labelledby={`r-${r.id}`}>
            <h2 id={`r-${r.id}`} className="font-display text-2xl font-semibold">{r.label}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cities.map((d) => (
                <li key={d.slug} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="font-semibold">{d.name} <span className="font-normal text-muted">· {d.country}</span></p>
                  <p className="mt-1 text-sm text-ink-soft">{d.tagline}</p>
                  <p className="mt-1 text-xs text-muted">Best: {monthsLabel(d.bestMonths)}</p>
                  <p className="mt-3 flex flex-wrap gap-2">
                    {guideLengths(d).map((n) => (
                      <Link key={n} href={guidePath(d.slug, n)} className="rounded-full bg-sand px-3 py-1 text-sm font-semibold text-ink-soft hover:text-ink">{n} days</Link>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
