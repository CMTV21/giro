import "server-only";
import { parseFlightStatus, type FlightStatus } from "../lib/flight-status.ts";
import { cached } from "./cache.ts";

/** Flight status from AeroDataBox (via RapidAPI). Cached 10 minutes per flight and date. Off without AERODATABOX_API_KEY. */

export const flightStatusEnabled = () => Boolean(process.env.AERODATABOX_API_KEY?.trim());

const HOST = "aerodatabox.p.rapidapi.com";
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export async function flightStatus(number: string, date: string, get: Fetcher = fetch): Promise<FlightStatus | undefined> {
  if (!flightStatusEnabled()) return undefined;
  return cached(`flight|${number}|${date}`, 10, async () => {
    const res = await get(`https://${HOST}/flights/number/${encodeURIComponent(number)}/${date}?withAircraftImage=false&withLocation=false`, {
      headers: { "x-rapidapi-key": process.env.AERODATABOX_API_KEY!.trim(), "x-rapidapi-host": HOST },
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 204 || res.status === 404) return undefined;
    if (!res.ok) throw new Error(`flight status ${res.status}`);
    return parseFlightStatus(await res.json());
  });
}
