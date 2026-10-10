"use client";

import { CalendarDays, Check, Copy, Download, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { calendarLinks } from "@/lib/calendar-links";
import { downloadFile, tripToICS } from "@/lib/export";
import { api, type TripBundle } from "@/lib/storage";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trip";

/** Download a one-off calendar file, or subscribe so the calendar follows every change to the plan. */
export function CalendarDialog({ bundle, canEdit, signedIn, onClose }: { bundle: TripBundle; canEdit: boolean; signedIn: boolean; onClose: () => void }) {
  const { trip } = bundle;
  const [token, setToken] = useState<string>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchToken = async (rotate = false) => {
    setBusy(true);
    setError(undefined);
    try {
      const r = await api<{ token: string }>(`/api/trips/${encodeURIComponent(trip.id)}/links`, { method: "POST", body: JSON.stringify({ purpose: "calendar", rotate }) });
      setToken(r.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get a calendar link.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (bundle.remote) void fetchToken();
  }, [bundle.remote]); // eslint-disable-line react-hooks/exhaustive-deps

  const feedUrl = token ? `${window.location.origin}/cal/${token}.ics` : undefined;
  const links = feedUrl ? calendarLinks(feedUrl, trip.title) : undefined;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="calendar-title" className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4" onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="card w-full max-w-md p-6 text-ink" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="calendar-title" className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5 text-brand" /> Add to your calendar</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        <section className="mt-4">
          <h3 className="text-sm font-semibold">Subscribe: stays up to date</h3>
          <p className="mt-0.5 text-sm text-muted">Your calendar follows the plan. Move a stop or change dates here and it updates there too, usually within a few hours.</p>
          {!bundle.remote ? (
            <p className="mt-3 rounded-xl bg-sand px-3 py-2 text-sm">
              {signedIn ? "Save this trip to your account to get a live calendar link." : <><Link href={`/login?next=${encodeURIComponent(`/trip/${trip.id}`)}`} className="font-semibold underline">Sign in</Link> to get a live calendar link. Your trip moves into your account.</>}
            </p>
          ) : error ? (
            <p className="mt-3 text-sm font-medium text-brand-dark" role="alert">{error}</p>
          ) : !links ? (
            <p className="mt-3 text-sm text-muted">Getting your link…</p>
          ) : (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <a href={links.google} target="_blank" rel="noopener noreferrer" className="btn-ghost justify-center py-2 text-sm">Google</a>
                <a href={links.apple} className="btn-ghost justify-center py-2 text-sm">Apple</a>
                <a href={links.outlook} target="_blank" rel="noopener noreferrer" className="btn-ghost justify-center py-2 text-sm">Outlook</a>
              </div>
              <div className="mt-3 flex gap-2">
                <input readOnly value={feedUrl} aria-label="Calendar link" className="field min-w-0 flex-1 py-2 text-xs" onFocus={(e) => e.target.select()} />
                <button
                  type="button"
                  className="btn-ghost shrink-0 py-2 text-xs"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(feedUrl!).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">Anyone with this link can see the plan, including notes. Share it only with people on the trip.</p>
              {canEdit && (
                <button type="button" disabled={busy} onClick={() => confirm("Turn off the current link? Calendars using it stop updating, and you'll get a new one.") && fetchToken(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink">
                  <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} /> Turn off this link and make a new one
                </button>
              )}
            </>
          )}
        </section>

        <section className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-semibold">Or download a copy</h3>
          <p className="mt-0.5 text-sm text-muted">A one-time file of the plan as it is now. It won&apos;t change if you edit the trip.</p>
          <button type="button" className="btn-ghost mt-3 py-2 text-sm" onClick={() => downloadFile(`${slug(trip.title)}.ics`, tripToICS(trip), "text/calendar")}><Download className="h-4 w-4" /> Download .ics</button>
        </section>
      </div>
    </div>
  );
}
