import { findDestination } from "./destinations.ts";
import type { TripRequest } from "./types.ts";

/**
 * Deep links into partner booking sites, pre-filled with the traveller's dates and party size.
 *
 * These are public search URLs, not API integrations: the user finishes booking on the partner
 * site. Affiliate IDs (when configured) are appended so referrals can be monetised. To move to
 * in-app booking, replace a provider's `url` builder with a call to its partner API.
 */

export type ProviderKind = "flights" | "stays" | "cars" | "experiences";

export interface BookingLink {
  provider: string;
  kind: ProviderKind;
  label: string;
  url: string;
  blurb: string;
}

export interface FlightQuery {
  origin: string;
  destination: string;
  depart: string;
  /** Omit for a one-way search. */
  ret?: string;
  adults: number;
  children: number;
}

export interface StayQuery {
  city: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  maxNightly?: number;
}

// Next.js only inlines NEXT_PUBLIC_* values accessed literally, so list them explicitly.
const AFFILIATE: Record<string, string | undefined> = {
  NEXT_PUBLIC_BOOKING_AID: process.env.NEXT_PUBLIC_BOOKING_AID,
  NEXT_PUBLIC_EXPEDIA_AFFCID: process.env.NEXT_PUBLIC_EXPEDIA_AFFCID,
  NEXT_PUBLIC_SKYSCANNER_ASSOCIATE_ID: process.env.NEXT_PUBLIC_SKYSCANNER_ASSOCIATE_ID,
  NEXT_PUBLIC_GETYOURGUIDE_PARTNER_ID: process.env.NEXT_PUBLIC_GETYOURGUIDE_PARTNER_ID,
  NEXT_PUBLIC_VIATOR_PID: process.env.NEXT_PUBLIC_VIATOR_PID,
};

const env = (key: string): string | undefined => AFFILIATE[key]?.trim() || undefined;

const enc = encodeURIComponent;

function withParams(base: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/** Resolve a city or code to an IATA code where we know one, otherwise return the input. */
export function airportCode(place: string): string {
  const trimmed = place.trim();
  if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  return findDestination(trimmed)?.airport ?? trimmed;
}

const isIata = (s: string) => /^[A-Z]{3}$/.test(s);

const mdy = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
};
const yymmdd = (iso: string) => iso.slice(2).replaceAll("-", "");

export function flightLinks(q: FlightQuery): BookingLink[] {
  const from = airportCode(q.origin);
  const to = airportCode(q.destination);
  const pax = q.adults + q.children;
  const route = `${q.origin} → ${q.destination}`;
  const links: BookingLink[] = [];

  links.push({
    provider: "Google Flights",
    kind: "flights",
    label: q.ret ? "Compare on Google Flights" : `${route} on Google Flights`,
    blurb: "Price graph, date grid and every airline in one view.",
    url: withParams("https://www.google.com/travel/flights", {
      q: q.ret
        ? `Flights to ${q.destination} from ${q.origin} on ${q.depart} through ${q.ret} for ${pax} passengers`
        : `One way flights to ${q.destination} from ${q.origin} on ${q.depart} for ${pax} passengers`,
      curr: "USD",
    }),
  });

  links.push({
    provider: "Expedia",
    kind: "flights",
    label: q.ret ? "Search Expedia flights" : `${route} on Expedia`,
    blurb: "Bundle with a hotel and save on packages.",
    url: withParams("https://www.expedia.com/Flights-Search", {
      trip: q.ret ? "roundtrip" : "oneway",
      leg1: `from:${from},to:${to},departure:${mdy(q.depart)}TANYT`,
      leg2: q.ret ? `from:${to},to:${from},departure:${mdy(q.ret)}TANYT` : undefined,
      passengers: `adults:${q.adults},children:${q.children}`,
      mode: "search",
      affcid: env("NEXT_PUBLIC_EXPEDIA_AFFCID"),
    }),
  });

  if (isIata(from) && isIata(to)) {
    const sky = `https://www.skyscanner.com/transport/flights/${from.toLowerCase()}/${to.toLowerCase()}/${yymmdd(q.depart)}/${q.ret ? `${yymmdd(q.ret)}/` : ""}`;
    links.push({
      provider: "Skyscanner",
      kind: "flights",
      label: q.ret ? "Search Skyscanner" : `${route} on Skyscanner`,
      blurb: "Great for budget carriers and flexible dates.",
      url: withParams(sky, {
        adultsv2: q.adults,
        childrenv2: q.children ? Array(q.children).fill("8").join("|") : undefined,
        associateid: env("NEXT_PUBLIC_SKYSCANNER_ASSOCIATE_ID"),
      }),
    });
    const kids = q.children ? `/children-${Array(q.children).fill("11").join("-")}` : "";
    links.push({
      provider: "Kayak",
      kind: "flights",
      label: q.ret ? "Search Kayak" : `${route} on Kayak`,
      blurb: "Price alerts and hacker fares.",
      url: `https://www.kayak.com/flights/${from}-${to}/${q.depart}${q.ret ? `/${q.ret}` : ""}/${q.adults}adults${kids}?sort=bestflight_a`,
    });
  }
  return links;
}

export function stayLinks(q: StayQuery): BookingLink[] {
  const children = q.children;
  return [
    {
      provider: "Airbnb",
      kind: "stays",
      label: "Browse Airbnb homes",
      blurb: "Whole apartments and unique stays, ideal for families and longer trips.",
      url: withParams(`https://www.airbnb.com/s/${enc(q.city)}/homes`, {
        checkin: q.checkIn,
        checkout: q.checkOut,
        adults: q.adults,
        children: children || undefined,
        price_max: q.maxNightly,
      }),
    },
    {
      provider: "Booking.com",
      kind: "stays",
      label: "Search Booking.com",
      blurb: "Huge hotel inventory, many with free cancellation.",
      url: withParams("https://www.booking.com/searchresults.html", {
        ss: q.city,
        checkin: q.checkIn,
        checkout: q.checkOut,
        group_adults: q.adults,
        group_children: children,
        no_rooms: Math.max(1, Math.ceil(q.adults / 2)),
        aid: env("NEXT_PUBLIC_BOOKING_AID"),
      }),
    },
    {
      provider: "Expedia",
      kind: "stays",
      label: "Search Expedia hotels",
      blurb: "Member prices and One Key rewards.",
      url: withParams("https://www.expedia.com/Hotel-Search", {
        destination: q.city,
        startDate: q.checkIn,
        endDate: q.checkOut,
        adults: q.adults,
        children: children ? Array(children).fill("1_8").join(",") : undefined,
        affcid: env("NEXT_PUBLIC_EXPEDIA_AFFCID"),
      }),
    },
    {
      provider: "Vrbo",
      kind: "stays",
      label: "Search Vrbo",
      blurb: "Entire homes for groups.",
      url: withParams("https://www.vrbo.com/search", {
        destination: q.city,
        startDate: q.checkIn,
        endDate: q.checkOut,
        adults: q.adults,
        children: children ? Array(children).fill("1_8").join(",") : undefined,
      }),
    },
  ];
}

export function carLinks(city: string, from: string, to: string): BookingLink[] {
  return [
    {
      provider: "Kayak",
      kind: "cars",
      label: "Compare rental cars",
      blurb: "Every major rental brand side by side.",
      url: `https://www.kayak.com/cars/${enc(city)}/${from}/${to}`,
    },
    {
      provider: "Expedia",
      kind: "cars",
      label: "Expedia car rental",
      blurb: "Often cheaper when bundled with a hotel.",
      url: withParams("https://www.expedia.com/carsearch", {
        locn: city,
        date1: mdy(from),
        date2: mdy(to),
        affcid: env("NEXT_PUBLIC_EXPEDIA_AFFCID"),
      }),
    },
  ];
}

export function experienceLinks(city: string, query?: string): BookingLink[] {
  const q = query ? `${query} ${city}` : city;
  return [
    {
      provider: "GetYourGuide",
      kind: "experiences",
      label: "Tickets and tours on GetYourGuide",
      blurb: "Skip-the-line tickets with free cancellation.",
      url: withParams("https://www.getyourguide.com/s/", { q, partner_id: env("NEXT_PUBLIC_GETYOURGUIDE_PARTNER_ID") }),
    },
    {
      provider: "Viator",
      kind: "experiences",
      label: "Tours on Viator",
      blurb: "Tripadvisor's marketplace of guided experiences.",
      url: withParams("https://www.viator.com/searchResults/all", { text: q, pid: env("NEXT_PUBLIC_VIATOR_PID") }),
    },
  ];
}

export function mapsSearchUrl(query: string): string {
  return withParams("https://www.google.com/maps/search/", { api: 1, query });
}

/** A walking route through the day's stops in Google Maps. */
export function mapsRouteUrl(stops: string[]): string | undefined {
  if (stops.length < 2) return undefined;
  const [origin, ...rest] = stops;
  const destination = rest.pop()!;
  return withParams("https://www.google.com/maps/dir/", {
    api: 1,
    origin,
    destination,
    waypoints: rest.length ? rest.join("|") : undefined,
    travelmode: "walking",
  });
}

/** All booking links for a trip, grouped by leg. */
export function tripBookingLinks(req: TripRequest, legs: { city: string; checkIn: string; checkOut: string; maxNightly?: number }[]) {
  const first = legs[0];
  const last = legs[legs.length - 1];
  const base = { adults: req.adults, children: req.children };
  const hasOrigin = req.origin.trim().length > 0;
  const openJaw = legs.length > 1 && first.city !== last.city;

  const flights: { title: string; links: BookingLink[] }[] = !hasOrigin
    ? []
    : openJaw
      ? [
          { title: `Outbound · ${req.origin} → ${first.city}`, links: flightLinks({ ...base, origin: req.origin, destination: first.city, depart: req.startDate }) },
          { title: `Return · ${last.city} → ${req.origin}`, links: flightLinks({ ...base, origin: last.city, destination: req.origin, depart: req.endDate }) },
        ]
      : [{ title: `Round trip · ${req.origin} ⇄ ${first.city}`, links: flightLinks({ ...base, origin: req.origin, destination: first.city, depart: req.startDate, ret: req.endDate }) }];

  return {
    flights,
    stays: legs.map((leg) => ({
      ...leg,
      links: stayLinks({ city: leg.city, checkIn: leg.checkIn, checkOut: leg.checkOut, ...base, maxNightly: leg.maxNightly }),
    })),
    cars: carLinks(first.city, req.startDate, req.endDate),
    experiences: legs.map((leg) => ({ city: leg.city, links: experienceLinks(leg.city) })),
  };
}
