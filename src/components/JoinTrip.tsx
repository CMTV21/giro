"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/storage";
import { useSession } from "./SessionProvider";

export function JoinTrip({ token }: { token: string }) {
  const { user } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!user) return;
    api<{ tripId: string }>("/api/invites/accept", { method: "POST", body: JSON.stringify({ token }) })
      .then(({ tripId }) => router.replace(`/trip/${tripId}?notice=joined&tab=group`))
      .catch((e: Error) => setError(e.message));
  }, [user, token, router]);

  const next = encodeURIComponent(`/join/${token}`);
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      {user === undefined ? (
        <p className="animate-pulse text-muted">Checking your invite…</p>
      ) : !user ? (
        <>
          <h1 className="font-display text-3xl font-semibold">You&apos;re invited on a trip</h1>
          <p className="mt-2 text-muted">Sign in or create a free account to join the group, vote on plans and split costs.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href={`/signup?next=${next}`} className="btn-primary">Create account</Link>
            <Link href={`/login?next=${next}`} className="btn-ghost">Sign in</Link>
          </div>
        </>
      ) : error ? (
        <>
          <h1 className="font-display text-3xl font-semibold">That invite didn&apos;t work</h1>
          <p className="mt-2 text-muted">{error}</p>
          <Link href="/trips" className="btn-primary mt-6">Go to my trips</Link>
        </>
      ) : (
        <p className="animate-pulse text-muted">Joining the trip…</p>
      )}
    </div>
  );
}
