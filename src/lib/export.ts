import { addDays, formatDate } from "./dates.ts";
import { scheduleDay } from "./schedule.ts";
import type { Trip } from "./types.ts";

const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Fold long lines to 75 octets as RFC 5545 requires (approximated by characters). */
const fold = (line: string) => line.match(/.{1,73}/g)?.join("\r\n ") ?? line;

const stamp = (iso: string, hour: number, minute = 0) =>
  `${iso.replaceAll("-", "")}T${String(hour).padStart(2, "0")}${String(minute).padStart(2, "0")}00`;

/** Calendar file with one event per activity (floating local time) and all-day events for each stay. */
export function tripToICS(trip: Trip, { feed = false } = {}): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Giro//Trip Planner//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${icsEscape(trip.title)}`];
  // Subscribed calendars: ask apps to re-check every few hours (Google decides its own pace).
  if (feed) lines.push("REFRESH-INTERVAL;VALUE=DURATION:PT3H", "X-PUBLISHED-TTL:PT3H", "METHOD:PUBLISH");
  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  for (const stay of trip.stays) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${trip.id}-stay-${stay.checkIn}@giro`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${stay.checkIn.replaceAll("-", "")}`,
      `DTEND;VALUE=DATE:${stay.checkOut.replaceAll("-", "")}`,
      `SUMMARY:${icsEscape(`Stay · ${stay.city} (${stay.area})`)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }

  for (const day of trip.days) {
    for (const it of scheduleDay(trip, day)) {
      if (it.kind === "meal") continue;
      const startDay = it.start >= 24 * 60 ? addDays(day.date, 1) : day.date;
      const endMin = Math.max(it.end, it.start + 15);
      const endDay = endMin >= 24 * 60 ? addDays(day.date, 1) : day.date;
      const a = it.activity;
      const uid = a ? a.id : `flight-${day.date}-${it.start}`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${trip.id}-${uid}@giro`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(startDay, Math.floor((it.start % 1440) / 60), it.start % 60)}`,
        `DTEND:${stamp(endDay, Math.floor((endMin % 1440) / 60), endMin % 60)}`,
        `SUMMARY:${icsEscape(it.kind === "flight" ? `✈ ${it.label}` : it.label)}`,
        ...(a ? [`DESCRIPTION:${icsEscape([a.description, a.note ? `Note: ${a.note}` : "", a.tip ? `Tip: ${a.tip}` : ""].filter(Boolean).join("\n"))}`] : []),
        ...(a?.area ? [`LOCATION:${icsEscape(`${a.area}, ${day.city}`)}`] : []),
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function tripToText(trip: Trip): string {
  const out: string[] = [`${trip.title}`, trip.summary, ""];
  for (const day of trip.days) {
    out.push(`Day ${day.index + 1} · ${formatDate(day.date)} · ${day.city} — ${day.theme}`);
    for (const a of day.activities) out.push(`  • [${a.slot}] ${a.title}${a.area ? ` (${a.area})` : ""}`);
    if (day.eat) out.push(`  🍽 ${day.eat}`);
    out.push("");
  }
  out.push(`Estimated total: $${trip.budget.total.toLocaleString()} ($${trip.budget.perPerson.toLocaleString()} per person)`);
  out.push("Planned with Giro");
  return out.join("\n");
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Share links carry the whole trip in the URL fragment (never sent to a server), deflate-compressed.
const toB64Url = (bytes: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeTrip(trip: Trip): Promise<string> {
  // Shared copies omit personal booking details (references, links) and private checklists.
  const shareable: Trip = {
    ...trip,
    packed: undefined,
    flights: trip.flights?.map(({ confirmation: _c, ...f }) => f),
    stays: trip.stays.map((st) => (st.booking ? { ...st, booking: { ...st.booking, confirmation: undefined, url: undefined } } : st)),
  };
  const json = new TextEncoder().encode(JSON.stringify(shareable));
  return toB64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function decodeTrip(encoded: string): Promise<Trip | undefined> {
  try {
    const json = await pipe(fromB64Url(encoded), new DecompressionStream("deflate-raw"));
    const trip = JSON.parse(new TextDecoder().decode(json)) as Trip;
    if (!trip || typeof trip.id !== "string" || !Array.isArray(trip.days) || !trip.request) return undefined;
    // Shared links are untrusted input: constrain anything used in URLs or styles.
    const hex = /^#[0-9a-f]{3,8}$/i;
    const palette: [string, string] = Array.isArray(trip.palette) && trip.palette.every((c) => typeof c === "string" && hex.test(c)) ? [trip.palette[0], trip.palette[1]] : ["#0b1220", "#ff5a36"];
    return { ...trip, id: trip.id.replace(/[^a-z0-9]/gi, "").slice(0, 24) || "shared", palette };
  } catch {
    return undefined;
  }
}
