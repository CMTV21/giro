import { NextResponse } from "next/server";
import { findDestination } from "@/lib/destinations";
import { parseForecast } from "@/lib/weather";

/**
 * Forecast proxy for Giro Live. Open-Meteo is free for non-commercial use; for production set
 * OPEN_METEO_API_KEY to use the commercial endpoints (the key never reaches the browser).
 */
const KEY = process.env.OPEN_METEO_API_KEY;
const FORECAST = KEY ? "https://customer-api.open-meteo.com/v1/forecast" : "https://api.open-meteo.com/v1/forecast";
const GEOCODE = KEY ? "https://customer-geocoding-api.open-meteo.com/v1/search" : "https://geocoding-api.open-meteo.com/v1/search";

async function coords(city: string): Promise<{ lat: number; lon: number } | undefined> {
  const d = findDestination(city);
  if (d && Number.isFinite(d.lat)) return { lat: d.lat, lon: d.lon };
  const url = new URL(GEOCODE);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  if (KEY) url.searchParams.set("apikey", KEY);
  const res = await fetch(url, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(4000) });
  if (!res.ok) return undefined;
  const hit = ((await res.json()) as { results?: { latitude: number; longitude: number }[] }).results?.[0];
  return hit ? { lat: hit.latitude, lon: hit.longitude } : undefined;
}

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get("city")?.slice(0, 80).trim();
  if (!city) return NextResponse.json({ error: "missing_city" }, { status: 400 });
  try {
    const at = await coords(city);
    if (!at) return NextResponse.json({ error: "unknown_city" }, { status: 404 });
    const url = new URL(FORECAST);
    url.searchParams.set("latitude", String(at.lat));
    url.searchParams.set("longitude", String(at.lon));
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
    url.searchParams.set("hourly", "precipitation_probability");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "16");
    if (KEY) url.searchParams.set("apikey", KEY);
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
    const forecast = res.ok ? parseForecast(await res.json()) : undefined;
    if (!forecast) return NextResponse.json({ error: "unavailable" }, { status: 502 });
    return NextResponse.json(forecast, { headers: { "cache-control": "public, max-age=900" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
