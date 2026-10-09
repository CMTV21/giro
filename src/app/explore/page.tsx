import type { Metadata } from "next";
import { ExploreGrid } from "@/components/ExploreGrid";

export const metadata: Metadata = { title: "Explore destinations" };

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="eyebrow">Explore</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Where should you go?</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">Pick what you love and when you&apos;re travelling. Giro ranks destinations by fit and season.</p>
      <div className="mt-8">
        <ExploreGrid />
      </div>
    </div>
  );
}
