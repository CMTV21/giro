"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { track } from "@/lib/funnel-client";
import { useSession } from "./SessionProvider";

const tripFromUrl = () => new URLSearchParams(window.location.search).get("trip")?.slice(0, 40) || undefined;

/** "Get the Pass" while it's in beta: a waitlist sign-up. Nothing is charged. */
export function PassWaitlist() {
  const { user } = useSession();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "already">("idle");
  const [error, setError] = useState<string>();

  useEffect(() => track("pass_viewed", tripFromUrl()), []);
  useEffect(() => {
    if (user?.email) setEmail((e) => e || user.email);
  }, [user?.email]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setState("busy");
    try {
      const res = await fetch("/api/pass/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, tripId: tripFromUrl() }),
      });
      const json = (await res.json().catch(() => ({}))) as { added?: boolean; message?: string };
      if (!res.ok) throw new Error(json.message ?? "Couldn't add you just now. Please try again.");
      setState(json.added ? "done" : "already");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add you just now. Please try again.");
      setState("idle");
    }
  }

  if (state === "done" || state === "already") {
    return (
      <p className="mt-6 flex items-start gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-ink" role="status">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        {state === "done" ? "You're on the list. We'll email you once when the Pass is ready." : "You're already on the list. We'll email you once when the Pass is ready."}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-2">
      <label htmlFor="pass-email" className="text-sm font-semibold">Get the Pass when it launches</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="pass-email" type="email" required autoComplete="email" className="field py-2" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" className="btn-primary shrink-0" disabled={state === "busy"}>{state === "busy" ? "Adding…" : "Join the waitlist"}</button>
      </div>
      <p className="text-xs text-muted">Nothing is charged. We&apos;ll email you once when it&apos;s ready, and use your email for nothing else.</p>
      {error && <p className="text-sm font-medium text-amber-800" role="alert">{error}</p>}
    </form>
  );
}
