import type { Metadata } from "next";
import { Suspense } from "react";
import { GuideView } from "@/components/trip/GuideView";

export const metadata: Metadata = { title: "Sightseeing guide", robots: { index: false } };

export default function GuidePage() {
  return (
    <Suspense fallback={<div className="mx-auto h-[60vh] max-w-4xl animate-pulse px-4 py-10"><div className="h-64 rounded-3xl bg-sand" /></div>}>
      <GuideView />
    </Suspense>
  );
}
