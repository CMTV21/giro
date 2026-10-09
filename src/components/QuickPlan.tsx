"use client";

import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addDays, toISODate } from "@/lib/dates";
import { DESTINATIONS } from "@/lib/destinations";

export function QuickPlan() {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [adults, setAdults] = useState(2);

  useEffect(() => {
    const s = addDays(toISODate(new Date()), 30);
    setStart(s);
    setEnd(addDays(s, 5));
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const p = new URLSearchParams({ to, start, end, adults: String(adults) });
        router.push(`/plan?${p.toString()}`);
      }}
      className="card grid gap-2 p-2 sm:grid-cols-[1.4fr_1fr_1fr_0.7fr_auto] sm:items-center sm:rounded-full"
    >
      <datalist id="quick-destinations">
        {DESTINATIONS.map((d) => <option key={d.slug} value={d.name} />)}
      </datalist>
      <Field icon={<MapPin className="h-4 w-4" />} label="Where">
        <input required list="quick-destinations" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Lisbon, Tokyo, anywhere…" className="w-full bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-muted/70" />
      </Field>
      <Field icon={<CalendarDays className="h-4 w-4" />} label="Depart">
        <input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value >= end) setEnd(addDays(e.target.value, 5)); }} className="w-full bg-transparent text-[15px] font-medium outline-none" />
      </Field>
      <Field icon={<CalendarDays className="h-4 w-4" />} label="Return">
        <input type="date" value={end} min={start ? addDays(start, 1) : undefined} onChange={(e) => setEnd(e.target.value)} className="w-full bg-transparent text-[15px] font-medium outline-none" />
      </Field>
      <Field icon={<Users className="h-4 w-4" />} label="Adults">
        <select value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="w-full bg-transparent text-[15px] font-medium outline-none">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>
      <button type="submit" className="btn-primary h-12 px-6 sm:h-14 sm:rounded-full">
        Curate <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl px-4 py-2.5 transition hover:bg-sand/60 sm:rounded-full">
      <span className="text-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</span>
        {children}
      </span>
    </label>
  );
}
