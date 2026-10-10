/** Live flight status (AeroDataBox), parsed defensively. Times are local to each airport. */

export interface FlightStatus {
  status: string;
  /** Human wording: "On time", "Delayed 1 h 20 min", "Cancelled"… */
  label: string;
  tone: "ok" | "warn" | "bad";
  departTime?: string;
  departRevised?: string;
  departGate?: string;
  departTerminal?: string;
  arriveDate?: string;
  arriveTime?: string;
  arriveRevised?: string;
  /** Date of the revised (or scheduled) arrival, YYYY-MM-DD. */
  arriveRevisedDate?: string;
  baggage?: string;
}

/** "2026-11-10 21:35-04:00" → { date, time }. */
function localParts(v: unknown): { date: string; time: string } | undefined {
  const m = typeof v === "string" ? /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(v) : null;
  return m ? { date: m[1], time: m[2] } : undefined;
}
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 20) : undefined);

/** Minutes between a scheduled and revised local time (handles crossing midnight). */
export function delayMinutes(sched: { date: string; time: string }, revised: { date: string; time: string }): number {
  return dayDiff(sched.date, revised.date) * 1440 + mins(revised.time) - mins(sched.time);
}

const lengthLabel = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

export function parseFlightStatus(json: unknown): FlightStatus | undefined {
  const f = (Array.isArray(json) ? json[0] : json) as Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!f || typeof f !== "object") return undefined;
  const status = text(f.status) ?? "Unknown";
  const dSched = localParts(f.departure?.scheduledTime?.local);
  const dRev = localParts(f.departure?.revisedTime?.local) ?? localParts(f.departure?.runwayTime?.local);
  const aSched = localParts(f.arrival?.scheduledTime?.local);
  const aRev = localParts(f.arrival?.revisedTime?.local) ?? localParts(f.arrival?.predictedTime?.local) ?? localParts(f.arrival?.runwayTime?.local);
  const late = aSched && aRev ? delayMinutes(aSched, aRev) : dSched && dRev ? delayMinutes(dSched, dRev) : 0;
  const cancelled = /cancel/i.test(status);
  const diverted = /divert/i.test(status);
  const label = cancelled ? "Cancelled" : diverted ? "Diverted" : /arrived|landed/i.test(status) ? (late >= 15 ? `Landed ${lengthLabel(late)} late` : "Landed") : late >= 15 ? `Delayed ${lengthLabel(late)}` : late <= -15 ? `Early by ${lengthLabel(-late)}` : "On time";
  return {
    status,
    label,
    tone: cancelled || diverted ? "bad" : late >= 15 ? "warn" : "ok",
    departTime: dSched?.time,
    departRevised: dRev?.time,
    departGate: text(f.departure?.gate),
    departTerminal: text(f.departure?.terminal),
    arriveDate: aSched?.date,
    arriveTime: aSched?.time,
    arriveRevised: aRev?.time,
    arriveRevisedDate: aRev?.date ?? aSched?.date,
    baggage: text(f.arrival?.baggageBelt),
  };
}

/** Normalised flight number for lookups: "AC 1906" → "AC1906". */
export const flightNumberKey = (s: string | undefined) => {
  const k = (s ?? "").toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(k) ? k : undefined;
};
