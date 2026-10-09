import type { Metadata } from "next";
import { TripList } from "@/components/TripList";

export const metadata: Metadata = { title: "My trips" };

export default function TripsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="eyebrow">My trips</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Saved itineraries</h1>
      <p className="mt-3 text-ink-soft">Trips are saved in this browser.</p>
      <div className="mt-8">
        <TripList />
      </div>
    </div>
  );
}
