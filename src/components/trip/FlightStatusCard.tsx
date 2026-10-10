"use client";

import { Plane } from "lucide-react";
import { useEffect, useState } from "react";
import { withFlights } from "@/lib/bookings";
import { addDays } from "@/lib/dates";
import { delayMinutes, flightNumberKey, type FlightStatus } from "@/lib/flight-status";
import { clock, toMinutes } from "@/lib/schedule";
import type { Flight, Trip } from "@/lib/types";

const TONE = { ok: "bg-emerald-50 text-emerald-900", warn: "bg-amber-50 text-amber-950", bad: "bg-red-50 text-red-900" } as const;

/** Live status for booked flights leaving or landing today or tomorrow, with a one-tap re-time when the arrival moves. */
export function FlightStatusCard({ trip, todayISO, readOnly, onChange, onMessage }: { trip: Trip; todayISO: string; readOnly: boolean; onChange: (t: Trip) => void; onMessage?: (m: string) => void }) {
  const tomorrow = addDays(todayISO, 1);
  const relevant = (trip.flights ?? []).filter((f) => flightNumberKey(f.flightNumber) && [todayISO, tomorrow].some((d) => f.departDate === d || f.arriveDate === d));
  const [statuses, setStatuses] = useState<Record<string, FlightStatus | null>>({});
  const key = relevant.map((f) => `${f.id}:${f.flightNumber}:${f.departDate}`).join("|");

  useEffect(() => {
    if (!relevant.length) return;
    let live = true;
    const load = () =>
      Promise.all(
        relevant.map(async (f) => {
          const r = await fetch(`/api/flight-status?${new URLSearchParams({ number: flightNumberKey(f.flightNumber)!, date: f.departDate })}`).catch(() => undefined);
          const j = r?.ok ? ((await r.json()) as { enabled?: boolean; status?: FlightStatus | null }) : undefined;
          return [f.id, j?.enabled ? j.status ?? null : undefined] as const;
        }),
      ).then((pairs) => live && setStatuses(Object.fromEntries(pairs.filter(([, s]) => s !== undefined)) as Record<string, FlightStatus | null>));
    void load();
    const t = setInterval(load, 5 * 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = relevant.filter((f) => statuses[f.id]);
  if (!rows.length) return null;

  const retime = (f: Flight, s: FlightStatus) => {
    const flights = (trip.flights ?? []).map((x) => (x.id === f.id ? { ...x, arriveTime: s.arriveRevised!, arriveDate: s.arriveRevisedDate ?? x.arriveDate } : x));
    const change = withFlights(trip, flights);
    onChange(change.trip);
    onMessage?.([`Arrival updated to ${clock(toMinutes(s.arriveRevised!)!)}; the day is re-timed.`, change.message].filter(Boolean).join(" "));
  };

  return (
    <section aria-labelledby="flight-status-title" className="card p-5">
      <h3 id="flight-status-title" className="flex items-center gap-2 font-semibold"><Plane className="h-4 w-4" /> Your flights</h3>
      <ul className="mt-3 space-y-2">
        {rows.map((f) => {
          const s = statuses[f.id]!;
          // How far the expected arrival is from what's saved on the trip (in minutes).
          const moved = s.arriveRevised ? delayMinutes({ date: f.arriveDate, time: f.arriveTime }, { date: s.arriveRevisedDate ?? f.arriveDate, time: s.arriveRevised }) : 0;
          return (
            <li key={f.id} className={`rounded-xl px-3.5 py-2.5 text-sm ${TONE[s.tone]}`}>
              <p className="font-semibold">{[f.airline, f.flightNumber].filter(Boolean).join(" ")} · {f.from} → {f.to} · {s.label}</p>
              <p className="mt-0.5 text-xs opacity-90">
                {[
                  s.departTime && `Departs ${clock(toMinutes(s.departRevised ?? s.departTime)!)}`,
                  s.departTerminal && `Terminal ${s.departTerminal}`,
                  s.departGate && `Gate ${s.departGate}`,
                  s.arriveTime && `Arrives ${clock(toMinutes(s.arriveRevised ?? s.arriveTime)!)}`,
                  s.baggage && `Bags: belt ${s.baggage}`,
                ].filter(Boolean).join(" · ")}
              </p>
              {!readOnly && Math.abs(moved) >= 30 && (
                <button type="button" className="mt-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold hover:bg-white" onClick={() => retime(f, s)}>
                  Update arrival to {clock(toMinutes(s.arriveRevised!)!)} and re-time the day
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">Live status from AeroDataBox, refreshed every 5 minutes. Always check the airport screens.</p>
    </section>
  );
}
