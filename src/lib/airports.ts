import { normalizeCity } from "./destinations.ts";

export interface Airport {
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  aliases?: string[];
}

/** Common departure cities. Canadian hubs first, since that's Giro's home market. */
export const AIRPORTS: Airport[] = [
  { code: "YYZ", city: "Toronto", country: "Canada", lat: 43.6777, lon: -79.6248, aliases: ["toronto pearson", "yto", "gta"] },
  { code: "YUL", city: "Montréal", country: "Canada", lat: 45.4706, lon: -73.7408, aliases: ["montreal", "ymq"] },
  { code: "YVR", city: "Vancouver", country: "Canada", lat: 49.1967, lon: -123.1815 },
  { code: "YYC", city: "Calgary", country: "Canada", lat: 51.1215, lon: -114.0076 },
  { code: "YEG", city: "Edmonton", country: "Canada", lat: 53.3097, lon: -113.5801, aliases: ["yea"] },
  { code: "YOW", city: "Ottawa", country: "Canada", lat: 45.3225, lon: -75.6692 },
  { code: "YWG", city: "Winnipeg", country: "Canada", lat: 49.91, lon: -97.2399 },
  { code: "YHZ", city: "Halifax", country: "Canada", lat: 44.8808, lon: -63.5086 },
  { code: "YQB", city: "Québec City", country: "Canada", lat: 46.7911, lon: -71.3933, aliases: ["quebec city", "quebec"] },
  { code: "YYJ", city: "Victoria", country: "Canada", lat: 48.6469, lon: -123.4258 },
  { code: "YXE", city: "Saskatoon", country: "Canada", lat: 52.1708, lon: -106.6997 },
  { code: "YQR", city: "Regina", country: "Canada", lat: 50.4319, lon: -104.6658 },
  { code: "YLW", city: "Kelowna", country: "Canada", lat: 49.9561, lon: -119.3778 },
  { code: "YYT", city: "St. John's", country: "Canada", lat: 47.6186, lon: -52.7519, aliases: ["st johns"] },
  { code: "NYC", city: "New York", country: "United States", lat: 40.6413, lon: -73.7781, aliases: ["jfk", "ewr", "lga", "new york city", "nyc"] },
  { code: "LAX", city: "Los Angeles", country: "United States", lat: 33.9416, lon: -118.4085, aliases: ["la"] },
  { code: "SFO", city: "San Francisco", country: "United States", lat: 37.6213, lon: -122.379 },
  { code: "CHI", city: "Chicago", country: "United States", lat: 41.9742, lon: -87.9073, aliases: ["ord", "mdw"] },
  { code: "BOS", city: "Boston", country: "United States", lat: 42.3656, lon: -71.0096 },
  { code: "SEA", city: "Seattle", country: "United States", lat: 47.4502, lon: -122.3088 },
  { code: "MIA", city: "Miami", country: "United States", lat: 25.7959, lon: -80.287 },
  { code: "WAS", city: "Washington", country: "United States", lat: 38.9531, lon: -77.4565, aliases: ["iad", "dca", "washington dc"] },
  { code: "DFW", city: "Dallas", country: "United States", lat: 32.8998, lon: -97.0403 },
  { code: "ATL", city: "Atlanta", country: "United States", lat: 33.6407, lon: -84.4277 },
  { code: "DEN", city: "Denver", country: "United States", lat: 39.8561, lon: -104.6737 },
  { code: "LON", city: "London", country: "United Kingdom", lat: 51.47, lon: -0.4543, aliases: ["lhr", "lgw"] },
  { code: "PAR", city: "Paris", country: "France", lat: 49.0097, lon: 2.5479, aliases: ["cdg"] },
  { code: "AMS", city: "Amsterdam", country: "Netherlands", lat: 52.3105, lon: 4.7683 },
  { code: "FRA", city: "Frankfurt", country: "Germany", lat: 50.0379, lon: 8.5622 },
  { code: "MAD", city: "Madrid", country: "Spain", lat: 40.4983, lon: -3.5676 },
  { code: "SYD", city: "Sydney", country: "Australia", lat: -33.9399, lon: 151.1753 },
  { code: "MEL", city: "Melbourne", country: "Australia", lat: -37.669, lon: 144.841 },
  { code: "AKL", city: "Auckland", country: "New Zealand", lat: -37.0082, lon: 174.785 },
  { code: "MEX", city: "Mexico City", country: "Mexico", lat: 19.4361, lon: -99.0719 },
  { code: "DEL", city: "Delhi", country: "India", lat: 28.5562, lon: 77.1 },
  { code: "BOM", city: "Mumbai", country: "India", lat: 19.0896, lon: 72.8656 },
  { code: "TYO", city: "Tokyo", country: "Japan", lat: 35.772, lon: 140.3929, aliases: ["nrt", "hnd"] },
  { code: "ZRH", city: "Zurich", country: "Switzerland", lat: 47.4582, lon: 8.5555 },
];

export function findAirport(input: string): Airport | undefined {
  const raw = input.trim();
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  const byCode = AIRPORTS.find((a) => a.code === upper);
  if (byCode) return byCode;
  const q = normalizeCity(raw);
  return AIRPORTS.find((a) => normalizeCity(a.city) === q || a.aliases?.some((al) => normalizeCity(al) === q));
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Indicative economy return fare (USD) from great-circle distance, calibrated against typical
 * published fares (e.g. Toronto–Paris ≈ $650, Toronto–Tokyo ≈ $1,050, Toronto–Cancún ≈ $400).
 * Long-haul costs rise per km beyond 8,000 km.
 */
export function fareForDistance(km: number): number {
  return 180 + km * 0.08 + Math.max(0, km - 8000) * 0.03;
}
