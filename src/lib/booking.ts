import { findAirport } from "./airports.ts";
import type { Currency } from "./currency.ts";
import { findDestination } from "./destinations.ts";
import { childAges, partyMix } from "./party.ts";
import type { TripRequest } from "./types.ts";

/**
 * Deep links into partner booking sites, pre-filled with the traveller's dates, party size and
 * currency. These are public search URLs: the traveller finishes booking on the partner site.
 * Partner IDs (when configured) are appended, and the UI routes clicks through `/go` so they're
 * attributed. To move to in-app booking, replace a provider's builder with its partner API.
 */

export type ProviderKind = "flights" | "stays" | "cars" | "experiences" | "reviews";

export interface BookingLink {
  provider: string;
  kind: ProviderKind;
  label: string;
  url: string;
  blurb: string;
  /** Rough value of what would be booked behind this link (USD), for commission projections. */
  valueUSD?: number;
}

interface Party {
  adults: number;
  children: number;
  /** Real ages make partner prices right (child fares, infants, teens priced as adults). */
  childAges?: number[];
  currency?: Currency;
}

export interface FlightQuery extends Party {
  origin: string;
  destination: string;
  depart: string;
  /** Omit for a one-way search. */
  ret?: string;
}

export interface StayQuery extends Party {
  city: string;
  checkIn: string;
  checkOut: string;
  /** Nightly price cap in the query's currency. */
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

/** Arrays become repeated parameters (e.g. Booking.com's one `age` per child). */
function withParams(base: string, params: Record<string, string | number | (string | number)[] | undefined>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
    else if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/** Country storefronts price in local currency, so Canadians see CAD without extra steps. */
interface Market {
  expedia: string;
  kayak: string;
  skyscanner: string;
  airbnb: string;
  tripadvisor: string;
}
const MARKETS: Partial<Record<Currency, Market>> = {
  CAD: { expedia: "www.expedia.ca", kayak: "www.ca.kayak.com", skyscanner: "www.skyscanner.ca", airbnb: "www.airbnb.ca", tripadvisor: "www.tripadvisor.ca" },
  GBP: { expedia: "www.expedia.co.uk", kayak: "www.kayak.co.uk", skyscanner: "www.skyscanner.net", airbnb: "www.airbnb.co.uk", tripadvisor: "www.tripadvisor.co.uk" },
  AUD: { expedia: "www.expedia.com.au", kayak: "www.kayak.com.au", skyscanner: "www.skyscanner.com.au", airbnb: "www.airbnb.com.au", tripadvisor: "www.tripadvisor.com.au" },
};
const DEFAULT_MARKET: Market = { expedia: "www.expedia.com", kayak: "www.kayak.com", skyscanner: "www.skyscanner.com", airbnb: "www.airbnb.com", tripadvisor: "www.tripadvisor.com" };
export const marketFor = (currency?: Currency): Market => (currency && MARKETS[currency]) || DEFAULT_MARKET;

/** Resolve a city or code to an IATA code where we know one, otherwise return the input. */
export function airportCode(place: string): string {
  const trimmed = place.trim();
  // A code the traveller typed (e.g. "JFK") is kept as-is rather than widened to a city code.
  if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  return findAirport(trimmed)?.code ?? findDestination(trimmed)?.airport ?? trimmed;
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
  const ages = childAges(q);
  const route = `${q.origin} → ${q.destination}`;
  const m = marketFor(q.currency);
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
      curr: q.currency ?? "USD",
    }),
  });

  links.push({
    provider: "Expedia",
    kind: "flights",
    label: q.ret ? "Search Expedia flights" : `${route} on Expedia`,
    blurb: "Bundle with a hotel and save on packages.",
    url: withParams(`https://${m.expedia}/Flights-Search`, {
      trip: q.ret ? "roundtrip" : "oneway",
      leg1: `from:${from},to:${to},departure:${mdy(q.depart)}TANYT`,
      leg2: q.ret ? `from:${to},to:${from},departure:${mdy(q.ret)}TANYT` : undefined,
      passengers: `adults:${q.adults},children:${q.children}${ages.length ? `[${ages.join(";")}]` : ""}`,
      mode: "search",
      affcid: env("NEXT_PUBLIC_EXPEDIA_AFFCID"),
    }),
  });

  if (isIata(from) && isIata(to)) {
    const sky = `https://${m.skyscanner}/transport/flights/${from.toLowerCase()}/${to.toLowerCase()}/${yymmdd(q.depart)}/${q.ret ? `${yymmdd(q.ret)}/` : ""}`;
    links.push({
      provider: "Skyscanner",
      kind: "flights",
      label: q.ret ? "Search Skyscanner" : `${route} on Skyscanner`,
      blurb: "Great for budget carriers and flexible dates.",
      url: withParams(sky, {
        adultsv2: q.adults,
        childrenv2: ages.length ? ages.join("|") : undefined,
        associateid: env("NEXT_PUBLIC_SKYSCANNER_ASSOCIATE_ID"),
      }),
    });
    // Kayak writes children by age, with under-2s as lap infants ("1L").
    const kids = ages.length ? `/children-${ages.map((a) => (a < 2 ? "1L" : String(a))).join("-")}` : "";
    links.push({
      provider: "Kayak",
      kind: "flights",
      label: q.ret ? "Search Kayak" : `${route} on Kayak`,
      blurb: "Price alerts and hacker fares.",
      url: `https://${m.kayak}/flights/${from}-${to}/${q.depart}${q.ret ? `/${q.ret}` : ""}/${q.adults}adults${kids}?sort=bestflight_a`,
    });
  }
  return links;
}

export function stayLinks(q: StayQuery): BookingLink[] {
  const m = marketFor(q.currency);
  const children = q.children;
  const ages = childAges(q);
  const mix = partyMix(q);
  const expediaKids = ages.length ? ages.map((a) => `1_${a}`).join(",") : undefined;
  return [
    {
      provider: "Airbnb",
      kind: "stays",
      label: "Browse Airbnb homes",
      blurb: "Whole apartments and unique stays, ideal for families and longer trips.",
      url: withParams(`https://${m.airbnb}/s/${enc(q.city)}/homes`, {
        checkin: q.checkIn,
        checkout: q.checkOut,
        // Airbnb counts 13+ as adults, 2–12 as children and under-2s as infants.
        adults: q.adults + mix.teens,
        children: mix.kids || undefined,
        infants: mix.infants || undefined,
        price_max: q.maxNightly ? Math.round(q.maxNightly) : undefined,
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
        age: ages.length ? ages : undefined,
        no_rooms: Math.max(1, Math.ceil(q.adults / 2)),
        selected_currency: q.currency,
        aid: env("NEXT_PUBLIC_BOOKING_AID"),
      }),
    },
    {
      provider: "Expedia",
      kind: "stays",
      label: "Search Expedia hotels",
      blurb: "Member prices and One Key rewards.",
      url: withParams(`https://${m.expedia}/Hotel-Search`, {
        destination: q.city,
        startDate: q.checkIn,
        endDate: q.checkOut,
        adults: q.adults,
        children: expediaKids,
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
        children: expediaKids,
      }),
    },
  ];
}

export function carLinks(city: string, from: string, to: string, currency?: Currency): BookingLink[] {
  const m = marketFor(currency);
  return [
    {
      provider: "Kayak",
      kind: "cars",
      label: "Compare rental cars",
      blurb: "Every major rental brand side by side.",
      url: `https://${m.kayak}/cars/${enc(city)}/${from}/${to}`,
    },
    {
      provider: "Expedia",
      kind: "cars",
      label: "Expedia car rental",
      blurb: "Often cheaper when bundled with a hotel.",
      url: withParams(`https://${m.expedia}/carsearch`, {
        locn: city,
        date1: mdy(from),
        date2: mdy(to),
        affcid: env("NEXT_PUBLIC_EXPEDIA_AFFCID"),
      }),
    },
  ];
}

export function experienceLinks(city: string, query?: string, currency?: Currency): BookingLink[] {
  const q = query ? `${query} ${city}` : city;
  return [
    {
      provider: "GetYourGuide",
      kind: "experiences",
      label: "Tickets and tours on GetYourGuide",
      blurb: "Skip-the-line tickets with free cancellation.",
      url: withParams("https://www.getyourguide.com/s/", { q, currency, partner_id: env("NEXT_PUBLIC_GETYOURGUIDE_PARTNER_ID") }),
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

/** Reviews and photos from other travellers on Tripadvisor (the traveller's country site). */
export function reviewsLink(query: string, city: string, currency?: Currency): BookingLink {
  const q = query.toLowerCase().includes(city.toLowerCase()) ? query : `${query} ${city}`;
  return {
    provider: "Tripadvisor",
    kind: "reviews",
    label: "Reviews on Tripadvisor",
    blurb: "Traveller reviews, photos and rankings.",
    url: withParams(`https://${marketFor(currency).tripadvisor}/Search`, { q }),
  };
}

/** Tripadvisor's live restaurant rankings for a city. */
export const topRestaurantsLink = (city: string, currency?: Currency): BookingLink => ({
  ...reviewsLink(`restaurants ${city}`, city, currency),
  label: "Top-rated restaurants on Tripadvisor",
});

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

export interface LegValue {
  city: string;
  checkIn: string;
  checkOut: string;
  /** Nightly cap in the trip currency. */
  maxNightly?: number;
  /** Estimated lodging spend for this leg (USD). */
  lodgingUSD?: number;
}

/** All booking links for a trip, grouped by leg, with value estimates for commission projections. */
export function tripBookingLinks(req: TripRequest, legs: LegValue[], flightsUSD = 0) {
  const first = legs[0];
  const last = legs[legs.length - 1];
  const base = { adults: req.adults, children: req.children, childAges: req.childAges, currency: req.currency };
  const hasOrigin = req.origin.trim().length > 0;
  const openJaw = legs.length > 1 && first.city !== last.city;
  const withValue = (links: BookingLink[], valueUSD?: number) => links.map((l) => ({ ...l, valueUSD }));

  const flights: { title: string; links: BookingLink[] }[] = !hasOrigin
    ? []
    : openJaw
      ? [
          { title: `Outbound · ${req.origin} → ${first.city}`, links: withValue(flightLinks({ ...base, origin: req.origin, destination: first.city, depart: req.startDate }), flightsUSD / 2) },
          { title: `Return · ${last.city} → ${req.origin}`, links: withValue(flightLinks({ ...base, origin: last.city, destination: req.origin, depart: req.endDate }), flightsUSD / 2) },
        ]
      : [{ title: `Round trip · ${req.origin} ⇄ ${first.city}`, links: withValue(flightLinks({ ...base, origin: req.origin, destination: first.city, depart: req.startDate, ret: req.endDate }), flightsUSD) }];

  return {
    flights,
    stays: legs.map((leg) => ({
      ...leg,
      links: withValue(stayLinks({ city: leg.city, checkIn: leg.checkIn, checkOut: leg.checkOut, ...base, maxNightly: leg.maxNightly }), leg.lodgingUSD),
    })),
    cars: carLinks(first.city, req.startDate, req.endDate, req.currency),
    experiences: legs.map((leg) => ({ city: leg.city, links: experienceLinks(leg.city, undefined, req.currency) })),
  };
}

/**
 * Route an outbound partner link through Giro's click tracker (`/go`), which records the click
 * for commission reconciliation and adds a per-click sub-ID where the program supports one.
 */
export function trackedHref(link: Pick<BookingLink, "url" | "provider" | "kind" | "valueUSD">, tripId?: string): string {
  const p = new URLSearchParams({ u: link.url, p: link.provider, k: link.kind });
  if (tripId) p.set("t", tripId);
  if (link.valueUSD && link.valueUSD > 0) p.set("v", String(Math.round(link.valueUSD)));
  return `/go?${p.toString()}`;
}
