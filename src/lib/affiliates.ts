/**
 * Partner programs Giro routes bookings to.
 *
 * Commission figures are ILLUSTRATIVE DEFAULTS for revenue projections only. Replace them with
 * the terms in each signed partner agreement. Parameter names follow each program's public
 * deep-link format; confirm them in the partner dashboard when you activate an account.
 */

export type CommissionModel =
  | { model: "percent"; rate: number }
  | { model: "per_click"; usd: number }
  | { model: "none" };

export interface AffiliateProgram {
  provider: string;
  /** Hostnames Giro may redirect to for this provider (exact or subdomain match). */
  hosts: string[];
  /** Query parameter carrying Giro's partner ID, and the env var that holds it. */
  idParam?: string;
  idEnv?: string;
  /** Query parameter for a per-click sub-ID, so conversions can be reconciled to clicks. */
  subIdParam?: string;
  commission: CommissionModel;
  /** Share of clicks assumed to convert to a booking, for projections. */
  assumedConversion: number;
  program: string;
}

export const AFFILIATES: AffiliateProgram[] = [
  { provider: "Booking.com", hosts: ["booking.com"], idParam: "aid", idEnv: "NEXT_PUBLIC_BOOKING_AID", subIdParam: "label", commission: { model: "percent", rate: 0.04 }, assumedConversion: 0.04, program: "Booking.com Affiliate Partner Programme" },
  { provider: "Expedia", hosts: ["expedia.com", "expedia.ca", "expedia.co.uk", "expedia.com.au"], idParam: "affcid", idEnv: "NEXT_PUBLIC_EXPEDIA_AFFCID", commission: { model: "percent", rate: 0.03 }, assumedConversion: 0.03, program: "Expedia Group Affiliate Program" },
  { provider: "Vrbo", hosts: ["vrbo.com"], commission: { model: "percent", rate: 0.03 }, assumedConversion: 0.02, program: "Expedia Group Affiliate Program" },
  { provider: "GetYourGuide", hosts: ["getyourguide.com"], idParam: "partner_id", idEnv: "NEXT_PUBLIC_GETYOURGUIDE_PARTNER_ID", subIdParam: "cmp", commission: { model: "percent", rate: 0.08 }, assumedConversion: 0.06, program: "GetYourGuide Partner Program" },
  { provider: "Viator", hosts: ["viator.com"], idParam: "pid", idEnv: "NEXT_PUBLIC_VIATOR_PID", commission: { model: "percent", rate: 0.08 }, assumedConversion: 0.05, program: "Viator Affiliate Program" },
  { provider: "Skyscanner", hosts: ["skyscanner.com", "skyscanner.ca", "skyscanner.net", "skyscanner.com.au"], idParam: "associateid", idEnv: "NEXT_PUBLIC_SKYSCANNER_ASSOCIATE_ID", commission: { model: "per_click", usd: 0.25 }, assumedConversion: 0, program: "Skyscanner Partners (via Impact)" },
  { provider: "Aviasales", hosts: ["aviasales.com"], idParam: "marker", idEnv: "NEXT_PUBLIC_TRAVELPAYOUTS_MARKER", subIdParam: "sub_id", commission: { model: "percent", rate: 0.012 }, assumedConversion: 0.02, program: "Travelpayouts (Aviasales)" },
  { provider: "Kayak", hosts: ["kayak.com", "kayak.ca", "kayak.co.uk", "kayak.com.au"], commission: { model: "per_click", usd: 0.2 }, assumedConversion: 0, program: "KAYAK affiliate network" },
  { provider: "Google Flights", hosts: ["google.com"], commission: { model: "none" }, assumedConversion: 0, program: "No affiliate program; drives trust, not revenue" },
  { provider: "Airbnb", hosts: ["airbnb.com", "airbnb.ca", "airbnb.co.uk", "airbnb.com.au"], commission: { model: "none" }, assumedConversion: 0, program: "No public affiliate program" },
  // Tripadvisor's affiliate program runs through partner networks; add its parameters here once approved.
  { provider: "Tripadvisor", hosts: ["tripadvisor.com", "tripadvisor.ca", "tripadvisor.co.uk", "tripadvisor.com.au"], commission: { model: "none" }, assumedConversion: 0, program: "Reviews link; apply via the Tripadvisor affiliate program to earn on hotel clicks" },
  { provider: "Google Maps", hosts: ["google.com"], commission: { model: "none" }, assumedConversion: 0, program: "Utility link" },
];

export function programFor(provider: string): AffiliateProgram | undefined {
  return AFFILIATES.find((a) => a.provider === provider);
}

export function hostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return AFFILIATES.some((a) => a.hosts.some((allowed) => h === allowed || h.endsWith(`.${allowed}`)));
}

/** Expected commission (USD) for one click, given the estimated booking value behind it. */
export function expectedCommission(provider: string, bookingValueUSD: number): number {
  const p = programFor(provider);
  if (!p) return 0;
  switch (p.commission.model) {
    case "percent":
      return bookingValueUSD * p.commission.rate * p.assumedConversion;
    case "per_click":
      return p.commission.usd;
    default:
      return 0;
  }
}
