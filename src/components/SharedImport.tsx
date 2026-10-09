"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { recalcBudget } from "@/lib/curate";
import { decodeTrip } from "@/lib/export";
import { saveTrip } from "@/lib/storage";

/** Opens a trip shared via link: the itinerary lives in the URL fragment and is saved to this browser. */
export function SharedImport() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const encoded = window.location.hash.slice(1);
    (async () => {
      const trip = encoded ? await decodeTrip(encoded) : undefined;
      if (!trip) return setFailed(true);
      try {
        const clean = recalcBudget(trip);
        saveTrip(clean);
        router.replace(`/trip/${clean.id}`);
      } catch {
        setFailed(true);
      }
    })();
  }, [router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      {failed ? (
        <>
          <h1 className="font-display text-3xl font-semibold">This link didn&apos;t work</h1>
          <p className="mt-2 text-muted">The shared trip may be incomplete. Ask for the link again, or plan your own.</p>
          <Link href="/plan" className="btn-primary mt-6">Plan a trip</Link>
        </>
      ) : (
        <p className="animate-pulse text-muted">Opening shared trip…</p>
      )}
    </div>
  );
}
