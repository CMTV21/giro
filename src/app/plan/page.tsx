import type { Metadata } from "next";
import { Suspense } from "react";
import { Planner } from "@/components/Planner";

export const metadata: Metadata = { title: "Plan a trip" };

export default function PlanPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <p className="eyebrow">Trip planner</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Let&apos;s plan something great.</h1>
        <p className="mt-3 text-lg text-ink-soft">A few details and Giro curates the rest. Switch to Advanced for multi-city trips, budgets and must-sees.</p>
      </div>
      <Suspense fallback={<div className="h-[70vh] animate-pulse rounded-3xl bg-sand" />}>
        <Planner />
      </Suspense>
    </div>
  );
}
