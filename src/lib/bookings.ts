import { airportCode } from "./booking.ts";
import { newId } from "./curate.ts";
import { normalizeCity } from "./destinations.ts";
import { fitToFlights } from "./schedule.ts";
import type { Flight, Paid, StayBooking, Trip } from "./types.ts";

const valid = (date: string, time: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{1,2}:\d{2}$/.test(time);

/** Same place? Compares airport codes and city names loosely ("YYZ" ≈ "Toronto"). */
export function samePlace(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ca = airportCode(a);
  const cb = airportCode(b);
  return ca.toUpperCase() === cb.toUpperCase() || normalizeCity(a) === normalizeCity(b);
}

/** Guess whether a flight is the way out, the way home, or a hop between cities. */
export function classifyFlight(trip: Pick<Trip, "request">, from: string, to: string): Flight["kind"] {
  const home = trip.request.origin;
  if (home && samePlace(to, home)) return "return";
  if (home && samePlace(from, home)) return "outbound";
  return "between";
}

export interface ExtractedFlight {
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  departDate: string;
  departTime: string;
  arriveDate: string;
  arriveTime: string;
  confirmation: string;
}

export interface ExtractedStay {
  name: string;
  address: string;
  city: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  checkOutTime: string;
  confirmation: string;
  total?: number;
  currency?: string;
  /** Set on import once the total has been converted. */
  paid?: Paid;
}

export function toFlights(trip: Pick<Trip, "request">, found: ExtractedFlight[]): Flight[] {
  return found
    .filter((f) => valid(f.departDate, f.departTime) && valid(f.arriveDate, f.arriveTime) && f.from && f.to)
    .map((f) => ({
      id: newId(),
      kind: classifyFlight(trip, f.from, f.to),
      airline: f.airline || undefined,
      flightNumber: f.flightNumber || undefined,
      from: f.from,
      to: f.to,
      departDate: f.departDate,
      departTime: f.departTime.padStart(5, "0"),
      arriveDate: f.arriveDate,
      arriveTime: f.arriveTime.padStart(5, "0"),
      confirmation: f.confirmation || undefined,
    }));
}

/** Attach extracted stays to the trip's legs by city (or by overlapping dates). */
export function applyStays(trip: Trip, found: ExtractedStay[]): { trip: Trip; matched: number } {
  let matched = 0;
  const stays = trip.stays.map((s) => {
    const hit = found.find((f) => (f.city && samePlace(f.city, s.city)) || (f.checkInDate && f.checkInDate >= s.checkIn && f.checkInDate < s.checkOut));
    if (!hit) return s;
    matched++;
    const booking: StayBooking = {
      name: hit.name || "Your stay",
      address: hit.address || undefined,
      checkInTime: /^\d{1,2}:\d{2}$/.test(hit.checkInTime) ? hit.checkInTime.padStart(5, "0") : undefined,
      checkOutTime: /^\d{1,2}:\d{2}$/.test(hit.checkOutTime) ? hit.checkOutTime.padStart(5, "0") : undefined,
      confirmation: hit.confirmation || undefined,
      paid: hit.paid,
    };
    return { ...s, booking };
  });
  return { trip: { ...trip, stays }, matched };
}

/** Sensible defaults for a new flight form. */
export function draftFlight(trip: Trip, kind: Flight["kind"]): Flight {
  const r = trip.request;
  const first = trip.stays[0]?.city ?? r.destinations[0];
  const last = trip.stays.at(-1)?.city ?? r.destinations.at(-1) ?? first;
  const base = { id: newId(), airline: "", flightNumber: "", confirmation: "" };
  if (kind === "return") return { ...base, kind, from: airportCode(last), to: r.origin ? airportCode(r.origin) : "", departDate: r.endDate, departTime: "12:00", arriveDate: r.endDate, arriveTime: "18:00" };
  if (kind === "between") {
    const leg = trip.stays[1];
    return { ...base, kind, from: airportCode(first), to: airportCode(leg?.city ?? last), departDate: leg?.checkIn ?? r.startDate, departTime: "10:00", arriveDate: leg?.checkIn ?? r.startDate, arriveTime: "12:00" };
  }
  return { ...base, kind, from: r.origin ? airportCode(r.origin) : "", to: airportCode(first), departDate: r.startDate, departTime: "08:00", arriveDate: r.startDate, arriveTime: "14:00" };
}

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

/** What a confirmation reader returns (from an upload or a forwarded email). */
export interface ExtractedBookingLike {
  flights?: ExtractedFlight[];
  stays?: ExtractedStay[];
  flightsTotal?: number;
  flightsCurrency?: string;
}

/**
 * Merge a read confirmation into a trip: new flights (skipping ones already there), stays matched
 * to legs, and totals as what was paid. `toPaid` converts a total, or returns undefined when it can't.
 * Returns undefined when the confirmation held nothing usable.
 */
export async function mergeBooking(
  trip: Trip,
  found: ExtractedBookingLike,
  toPaid: (total: number | undefined, currency: string | undefined) => Promise<Paid | undefined>,
): Promise<(BookingsChange & { flights: number; stays: number; summary: string }) | undefined> {
  const flights = toFlights(trip, found.flights ?? []);
  const known = new Set((trip.flights ?? []).map((f) => `${f.flightNumber}|${f.departDate}`));
  const fresh = flights.filter((f) => !f.flightNumber || !known.has(`${f.flightNumber}|${f.departDate}`));
  // The whole flight booking's total goes on its first new flight.
  const flightsPaid = await toPaid(found.flightsTotal, found.flightsCurrency);
  if (flightsPaid && fresh[0]) fresh[0] = { ...fresh[0], paid: flightsPaid };
  const stays = await Promise.all((found.stays ?? []).map(async (s) => ({ ...s, paid: await toPaid(s.total, s.currency) })));
  const { trip: withStay, matched } = applyStays(trip, stays);
  if (!fresh.length && !matched) return undefined;
  const change = withFlights(withStay, [...(trip.flights ?? []), ...fresh]);
  const summary = [fresh.length && `${fresh.length} flight${fresh.length > 1 ? "s" : ""}`, matched && `${matched} stay${matched > 1 ? "s" : ""}`].filter(Boolean).join(" and ");
  return { ...change, flights: fresh.length, stays: matched, summary };
}
