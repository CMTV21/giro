/** Forecast shape Giro Live uses, parsed from Open-Meteo's forecast API. */
export interface DayForecast {
  date: string;
  code: number;
  tmax: number;
  tmin: number;
  rain: number;
  hourlyRain: Record<number, number>;
}

export interface Forecast {
  days: DayForecast[];
  timezone: string;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function parseForecast(json: unknown): Forecast | undefined {
  if (!json || typeof json !== "object") return undefined;
  const j = json as { timezone?: string; daily?: Record<string, unknown[]>; hourly?: Record<string, unknown[]> };
  const d = j.daily;
  if (!d || !Array.isArray(d.time)) return undefined;
  const hourly: Record<string, Record<number, number>> = {};
  const ht = j.hourly?.time ?? [];
  const hp = j.hourly?.precipitation_probability ?? [];
  ht.forEach((t, i) => {
    if (typeof t !== "string") return;
    const [date, time] = t.split("T");
    (hourly[date] ??= {})[Number(time?.slice(0, 2))] = num(hp[i]);
  });
  return {
    timezone: typeof j.timezone === "string" ? j.timezone : "UTC",
    days: d.time.map((date, i) => ({
      date: String(date),
      code: num(d.weather_code?.[i]),
      tmax: num(d.temperature_2m_max?.[i]),
      tmin: num(d.temperature_2m_min?.[i]),
      rain: num(d.precipitation_probability_max?.[i]),
      hourlyRain: hourly[String(date)] ?? {},
    })),
  };
}
