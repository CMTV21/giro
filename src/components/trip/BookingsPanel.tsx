"use client";

import { BedDouble, FileUp, LoaderCircle, Pencil, Plane, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { applyStays, draftFlight, toFlights, type ExtractedFlight, type ExtractedStay } from "@/lib/bookings";
import { formatDate } from "@/lib/dates";
import { checkAI } from "@/lib/plan-client";
import { clock, fitToFlights, toMinutes } from "@/lib/schedule";
import { ApiError } from "@/lib/storage";
import type { Flight, StayBooking, Trip } from "@/lib/types";

const KIND_LABEL: Record<Flight["kind"], string> = { outbound: "Flight out", return: "Flight home", between: "Between cities" };

export interface BookingsChange {
  trip: Trip;
  message?: string;
}

/** Apply flight changes and re-fit the plan, explaining anything that moved. */
export function withFlights(trip: Trip, flights: Flight[]): BookingsChange {
  const { trip: fitted, moved, warnings } = fitToFlights({ ...trip, flights });
  const parts: string[] = [];
  if (moved.length) parts.push(`${moved.length} stop${moved.length > 1 ? "s" : ""} no longer fit around your flights, so ${moved.length > 1 ? "they're" : "it's"} in Ideas, ready to drag back in.`);
  parts.push(...warnings);
  return { trip: fitted, message: parts.join(" ") || undefined };
}

export function BookingsPanel({ trip, readOnly, onChange }: { trip: Trip; readOnly: boolean; onChange: (c: BookingsChange) => void }) {
  const [editing, setEditing] = useState<Flight>();
  const [stayEdit, setStayEdit] = useState<number>();
  const [ai, setAi] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string>();
  const flights = [...(trip.flights ?? [])].sort((a, b) => `${a.departDate}${a.departTime}`.localeCompare(`${b.departDate}${b.departTime}`));

  useEffect(() => {
    checkAI().then(setAi);
  }, []);

  const saveFlight = (f: Flight) => {
    const rest = (trip.flights ?? []).filter((x) => x.id !== f.id);
    onChange(withFlights(trip, [...rest, f]));
    setEditing(undefined);
  };
  const removeFlight = (id: string) => onChange(withFlights(trip, (trip.flights ?? []).filter((x) => x.id !== id)));
  const saveStay = (i: number, booking: StayBooking | undefined) => {
    onChange({ trip: { ...trip, stays: trip.stays.map((s, j) => (j === i ? { ...s, booking } : s)) } });
    setStayEdit(undefined);
  };

  async function importFile(file: File) {
    setImporting(true);
    setError(undefined);
    try {
      const body = new FormData();
      body.set("file", await shrinkImage(file));
      const res = await fetch("/api/extract/booking", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { flights?: ExtractedFlight[]; stays?: ExtractedStay[]; message?: string };
      if (!res.ok) throw new ApiError(res.status, "error", json.message ?? "We couldn't read that file.");
      const found = toFlights(trip, json.flights ?? []);
      const known = new Set((trip.flights ?? []).map((f) => `${f.flightNumber}|${f.departDate}`));
      const fresh = found.filter((f) => !f.flightNumber || !known.has(`${f.flightNumber}|${f.departDate}`));
      const { trip: withStay, matched } = applyStays(trip, json.stays ?? []);
      if (!fresh.length && !matched) {
        setError("We didn't find any flights or stays in that document. Add them by hand below.");
        return;
      }
      const change = withFlights(withStay, [...(trip.flights ?? []), ...fresh]);
      const added = [fresh.length && `${fresh.length} flight${fresh.length > 1 ? "s" : ""}`, matched && `${matched} stay${matched > 1 ? "s" : ""}`].filter(Boolean).join(" and ");
      onChange({ trip: change.trip, message: [`Added ${added} from your confirmation. Please check the details.`, change.message].filter(Boolean).join(" ") });
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't read that file.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="bookings-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="bookings-title" className="flex items-center gap-2 font-semibold"><Plane className="h-4 w-4" /> Flights & stays</h3>
        {!readOnly && ai && (
          <label className={`btn-ghost cursor-pointer py-1.5 text-xs ${importing ? "pointer-events-none opacity-60" : ""}`}>
            {importing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {importing ? "Reading…" : "Import from confirmation"}
            <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importFile(f); }} />
          </label>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">Add your booked flights and where you&apos;re staying. Giro times each day around them.</p>
      {error && <p role="alert" className="mt-3 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-dark">{error}</p>}

      <ul className="mt-4 space-y-2">
        {flights.map((f) =>
          editing?.id === f.id ? (
            <li key={f.id}><FlightForm value={editing} onCancel={() => setEditing(undefined)} onSave={saveFlight} /></li>
          ) : (
            <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700"><Plane className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">{KIND_LABEL[f.kind]}{f.airline || f.flightNumber ? ` · ${[f.airline, f.flightNumber].filter(Boolean).join(" ")}` : ""}</p>
                <p className="font-semibold">{f.from} → {f.to}</p>
                <p className="text-sm text-ink-soft">
                  {formatDate(f.departDate)}, {clock(toMinutes(f.departTime) ?? 0)} → {f.arriveDate !== f.departDate ? `${formatDate(f.arriveDate)}, ` : ""}{clock(toMinutes(f.arriveTime) ?? 0)}
                  {f.confirmation && <span className="text-muted"> · Ref {f.confirmation}</span>}
                </p>
              </div>
              {!readOnly && (
                <span className="flex gap-1">
                  <button type="button" aria-label="Edit flight" onClick={() => setEditing(f)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"><Pencil className="h-4 w-4" /></button>
                  <button type="button" aria-label="Remove flight" onClick={() => removeFlight(f.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"><Trash2 className="h-4 w-4" /></button>
                </span>
              )}
            </li>
          ),
        )}
        {editing && !flights.some((f) => f.id === editing.id) && <li><FlightForm value={editing} onCancel={() => setEditing(undefined)} onSave={saveFlight} /></li>}
      </ul>
      {!readOnly && !editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!flights.some((f) => f.kind === "outbound") && <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => setEditing(draftFlight(trip, "outbound"))}><Plus className="h-3.5 w-3.5" /> Flight out</button>}
          {!flights.some((f) => f.kind === "return") && <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => setEditing(draftFlight(trip, "return"))}><Plus className="h-3.5 w-3.5" /> Flight home</button>}
          {trip.stays.length > 1 && <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => setEditing(draftFlight(trip, "between"))}><Plus className="h-3.5 w-3.5" /> Flight between cities</button>}
        </div>
      )}

      <ul className="mt-5 space-y-2 border-t border-line pt-5">
        {trip.stays.map((s, i) => (
          <li key={s.city + s.checkIn}>
            {stayEdit === i ? (
              <StayForm stay={s.booking} onCancel={() => setStayEdit(undefined)} onSave={(b) => saveStay(i, b)} />
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sea-soft text-sea"><BedDouble className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">{s.city} · {formatDate(s.checkIn, { month: "short", day: "numeric" })} – {formatDate(s.checkOut, { month: "short", day: "numeric" })}</p>
                  {s.booking ? (
                    <>
                      <p className="font-semibold">{s.booking.name}</p>
                      <p className="text-sm text-ink-soft">
                        {s.booking.address}
                        {(s.booking.checkInTime || s.booking.checkOutTime) && <span className="text-muted">{s.booking.address ? " · " : ""}Check-in {s.booking.checkInTime ? clock(toMinutes(s.booking.checkInTime)!) : "—"}, check-out {s.booking.checkOutTime ? clock(toMinutes(s.booking.checkOutTime)!) : "—"}</span>}
                        {s.booking.confirmation && <span className="text-muted"> · Ref {s.booking.confirmation}</span>}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted">Suggested area: {s.area}</p>
                  )}
                </div>
                {!readOnly && (
                  <span className="flex gap-1">
                    <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => setStayEdit(i)}>{s.booking ? <><Pencil className="h-3.5 w-3.5" /> Edit</> : <><Plus className="h-3.5 w-3.5" /> Where you&apos;re staying</>}</button>
                    {s.booking && <button type="button" aria-label="Remove stay" onClick={() => saveStay(i, undefined)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"><Trash2 className="h-4 w-4" /></button>}
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FlightForm({ value, onSave, onCancel }: { value: Flight; onSave: (f: Flight) => void; onCancel: () => void }) {
  const [f, setF] = useState<Flight>(value);
  const [error, setError] = useState<string>();
  const set = (k: keyof Flight) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="space-y-3 rounded-2xl border border-line bg-sand/40 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.from.trim() || !f.to.trim()) return setError("Add where the flight leaves from and lands.");
        if (`${f.arriveDate}T${f.arriveTime}` <= `${f.departDate}T${f.departTime}` && f.from !== f.to) return setError("The flight needs to land after it leaves (use local times; check the arrival date for overnight flights).");
        onSave({ ...f, from: f.from.trim(), to: f.to.trim(), airline: f.airline?.trim() || undefined, flightNumber: f.flightNumber?.trim().toUpperCase() || undefined, confirmation: f.confirmation?.trim().toUpperCase() || undefined });
      }}
    >
      <div className="flex items-center justify-between">
        <select className="field w-auto py-2 text-sm font-semibold" value={f.kind} onChange={set("kind")} aria-label="Flight type">
          <option value="outbound">Flight out</option>
          <option value="return">Flight home</option>
          <option value="between">Between cities</option>
        </select>
        <button type="button" aria-label="Cancel" onClick={onCancel} className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Airline"><input className="field py-2" value={f.airline ?? ""} onChange={set("airline")} placeholder="Air Canada" /></Field>
        <Field label="Flight number"><input className="field py-2" value={f.flightNumber ?? ""} onChange={set("flightNumber")} placeholder="AC1906" /></Field>
        <Field label="From"><input className="field py-2" value={f.from} onChange={set("from")} placeholder="YYZ" required /></Field>
        <Field label="To"><input className="field py-2" value={f.to} onChange={set("to")} placeholder="LIS" required /></Field>
        <Field label="Departs"><div className="flex gap-1"><input type="date" className="field px-2 py-2" value={f.departDate} onChange={set("departDate")} required /><input type="time" className="field w-28 px-2 py-2" value={f.departTime} onChange={set("departTime")} required /></div></Field>
        <Field label="Lands (local time)"><div className="flex gap-1"><input type="date" className="field px-2 py-2" value={f.arriveDate} onChange={set("arriveDate")} required /><input type="time" className="field w-28 px-2 py-2" value={f.arriveTime} onChange={set("arriveTime")} required /></div></Field>
      </div>
      <Field label="Booking reference (optional)"><input className="field py-2" value={f.confirmation ?? ""} onChange={set("confirmation")} maxLength={40} /></Field>
      {error && <p role="alert" className="text-sm text-brand-dark">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-dark py-2">Save flight</button>
        <button type="button" className="btn-ghost py-2" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function StayForm({ stay, onSave, onCancel }: { stay?: StayBooking; onSave: (b: StayBooking) => void; onCancel: () => void }) {
  const [b, setB] = useState<StayBooking>(stay ?? { name: "", checkInTime: "15:00", checkOutTime: "11:00" });
  const [error, setError] = useState<string>();
  const set = (k: keyof StayBooking) => (e: React.ChangeEvent<HTMLInputElement>) => setB({ ...b, [k]: e.target.value });
  return (
    <form
      className="space-y-3 rounded-2xl border border-line bg-sand/40 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!b.name.trim()) return setError("Add the hotel or rental name.");
        if (b.url && !/^https?:\/\//i.test(b.url.trim())) return setError("Links need to start with https://");
        onSave({ ...b, name: b.name.trim(), address: b.address?.trim() || undefined, url: b.url?.trim() || undefined, confirmation: b.confirmation?.trim() || undefined, lat: stay?.address === b.address ? stay?.lat : undefined, lon: stay?.address === b.address ? stay?.lon : undefined });
      }}
    >
      <Field label="Hotel or rental"><input autoFocus className="field py-2" value={b.name} onChange={set("name")} placeholder="e.g. Memmo Alfama" required maxLength={160} /></Field>
      <Field label="Address"><input className="field py-2" value={b.address ?? ""} onChange={set("address")} placeholder="Street, city" maxLength={300} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Check-in time"><input type="time" className="field py-2" value={b.checkInTime ?? ""} onChange={set("checkInTime")} /></Field>
        <Field label="Check-out time"><input type="time" className="field py-2" value={b.checkOutTime ?? ""} onChange={set("checkOutTime")} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Booking reference"><input className="field py-2" value={b.confirmation ?? ""} onChange={set("confirmation")} maxLength={40} /></Field>
        <Field label="Booking link"><input className="field py-2" value={b.url ?? ""} onChange={set("url")} placeholder="https://" maxLength={500} /></Field>
      </div>
      {error && <p role="alert" className="text-sm text-brand-dark">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-dark py-2">Save stay</button>
        <button type="button" className="btn-ghost py-2" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

/**
 * Photos from phones are often 5–12 MB; shrink to ≤1600 px JPEG before upload (and convert
 * HEIC where the browser can decode it). PDFs and small images pass through unchanged.
 */
export async function shrinkImage(file: File, maxSide = 1600): Promise<Blob> {
  if (file.type === "application/pdf" || (!file.type.startsWith("image/") && !/\.hei[cf]$/i.test(file.name))) return file;
  if (file.size < 900_000 && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
