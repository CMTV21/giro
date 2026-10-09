import { addDays, formatDate } from "./dates.ts";
import type { Slot, Trip } from "./types.ts";

const SLOT_START: Record<Slot, number> = { morning: 9, afternoon: 14, evening: 19 };

const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Fold long lines to 75 octets as RFC 5545 requires (approximated by characters). */
const fold = (line: string) => line.match(/.{1,73}/g)?.join("\r\n ") ?? line;

const stamp = (iso: string, hour: number, minute = 0) =>
  `${iso.replaceAll("-", "")}T${String(hour).padStart(2, "0")}${String(minute).padStart(2, "0")}00`;

/** Calendar file with one event per activity (floating local time) and all-day events for each stay. */
export function tripToICS(trip: Trip): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Giro//Trip Planner//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${icsEscape(trip.title)}`];
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
    const used: Record<Slot, number> = { morning: 0, afternoon: 0, evening: 0 };
    for (const act of day.activities) {
      const startHour = SLOT_START[act.slot] + used[act.slot];
      used[act.slot] += Math.ceil(act.durationHrs);
      const endMinutes = Math.round(startHour * 60 + act.durationHrs * 60);
      const endDay = endMinutes >= 24 * 60 ? addDays(day.date, 1) : day.date;
      const em = endMinutes % (24 * 60);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${trip.id}-${act.id}@giro`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(day.date, Math.min(23, startHour))}`,
        `DTEND:${stamp(endDay, Math.floor(em / 60), em % 60)}`,
        `SUMMARY:${icsEscape(act.title)}`,
        `DESCRIPTION:${icsEscape([act.description, act.tip ? `Tip: ${act.tip}` : ""].filter(Boolean).join("\n"))}`,
        ...(act.area ? [`LOCATION:${icsEscape(`${act.area}, ${day.city}`)}`] : []),
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
  const json = new TextEncoder().encode(JSON.stringify({ ...trip, packed: undefined }));
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
