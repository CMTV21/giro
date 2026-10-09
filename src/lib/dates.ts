const DAY_MS = 86_400_000;

/** Parse YYYY-MM-DD as a UTC date so arithmetic is timezone-safe. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toISODate(new Date(parseISODate(iso).getTime() + days * DAY_MS));
}

export function nightsBetween(startISO: string, endISO: string): number {
  return Math.round((parseISODate(endISO).getTime() - parseISODate(startISO).getTime()) / DAY_MS);
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return toISODate(parseISODate(iso)) === iso;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  return parseISODate(iso).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function formatRange(startISO: string, endISO: string): string {
  const s = parseISODate(startISO);
  const e = parseISODate(endISO);
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const start = formatDate(startISO, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
  const end = formatDate(endISO, { month: "short", day: "numeric", year: "numeric" });
  return `${start} – ${end}`;
}

export function monthOf(iso: string): number {
  return parseISODate(iso).getUTCMonth() + 1;
}
