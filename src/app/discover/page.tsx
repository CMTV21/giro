import type { Metadata } from "next";
import { DiscoverView } from "@/components/DiscoverView";

export const metadata: Metadata = { title: "Discover by budget" };

export default function DiscoverPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="eyebrow">Discover</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Where can your budget take you?</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">Set a total budget and dates. Giro prices a full trip to every destination (flights, stays, food and things to do) and shows the best ones that fit.</p>
      <div className="mt-8">
        <DiscoverView />
      </div>
    </div>
  );
}
