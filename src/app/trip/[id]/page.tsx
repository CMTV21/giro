import type { Metadata } from "next";
import { Suspense } from "react";
import { TripView } from "@/components/trip/TripView";

export const metadata: Metadata = { title: "Your trip" };

export default function TripPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-[60vh] max-w-6xl animate-pulse px-4 py-10 sm:px-6"><div className="h-64 rounded-3xl bg-sand" /></div>}>
      <TripView />
    </Suspense>
  );
}
