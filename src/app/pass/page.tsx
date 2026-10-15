import { Check, Users } from "lucide-react";
import type { Metadata } from "next";
import { PassWaitlist } from "@/components/PassWaitlist";
import { PASS_FREE, PASS_INCLUDES, PASS_PRICE_CAD } from "@/lib/pass";

export const metadata: Metadata = {
  title: "Group Trip Pass",
  description: `Plan a group trip abroad together: unlimited travellers, voting, shared expenses and receipts, for one C$${PASS_PRICE_CAD} payment per trip.`,
};

export default function PassPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="eyebrow">Coming soon</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Group Trip Pass</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">
        One payment per trip, made by the organizer, for everything a group needs to plan and pay together. No subscription.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="card p-6" aria-labelledby="free-title">
          <h2 id="free-title" className="font-display text-2xl font-semibold">Free</h2>
          <p className="mt-1 text-sm text-muted">Always</p>
          <ul className="mt-5 space-y-3">
            {PASS_FREE.map((f) => (
              <li key={f} className="flex gap-3 text-ink-soft"><Check className="mt-0.5 h-4 w-4 shrink-0 text-sea" />{f}</li>
            ))}
          </ul>
        </section>

        <section className="card p-6 ring-2 ring-brand/40" aria-labelledby="pass-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="pass-title" className="flex items-center gap-2 font-display text-2xl font-semibold"><Users className="h-5 w-5 text-brand" /> Group Trip Pass</h2>
            <p className="font-display text-2xl font-semibold">C${PASS_PRICE_CAD}<span className="text-sm font-normal text-muted"> / trip</span></p>
          </div>
          <p className="mt-1 text-sm text-muted">Everything free, plus:</p>
          <ul className="mt-5 space-y-3">
            {PASS_INCLUDES.map((f) => (
              <li key={f} className="flex gap-3 text-ink-soft"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{f}</li>
            ))}
          </ul>
          <PassWaitlist />
        </section>
      </div>

      <p className="mt-8 max-w-2xl text-sm text-muted">
        While Giro is in beta, every feature is free for every trip.
      </p>
    </div>
  );
}
