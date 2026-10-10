import { BedDouble, CalendarDays, ExternalLink, Lightbulb, MapPin, Sparkles, Star, Ticket, UtensilsCrossed, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DayMapToggle } from "@/components/trip/DayMap";
import { AdvisoryRows } from "@/components/trip/AdvisoryNotice";
import { HeadsUpCard } from "@/components/trip/HeadsUp";
import { ADVISORY_SOURCE, COUNTRY_ISO, HOME_ISO } from "@/lib/advisories";
import { loadAdvisories } from "@/server/advisories";
import { PlacePhoto } from "@/components/trip/PlacePhoto";
import { FOOD } from "@/data/food";
import { experienceLinks, reviewsLink, stayLinks, trackedHref } from "@/lib/booking";
import { formatMoney, type FxSnapshot } from "@/lib/currency";
import { DESTINATIONS } from "@/lib/destinations";
import { priceLabel } from "@/lib/food";
import { allGuides, buildGuide, dailyPerPerson, GUIDE_LENGTHS, GUIDE_PLAN, guideLengths, guideDestination, guideParam, guidePath, monthsLabel, parseGuideParam } from "@/lib/guides";
import { getRates } from "@/lib/rates.server";
import { clock, scheduleDay } from "@/lib/schedule";
import { siteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return allGuides().map((g) => ({ city: g.slug, days: guideParam(g.days) }));
}

type Props = { params: Promise<{ city: string; days: string }> };

async function load(params: Props["params"]) {
  const { city, days } = await params;
  const dest = guideDestination(city);
  const n = parseGuideParam(days);
  if (!dest || !n || !guideLengths(dest).includes(n)) notFound();
  return { dest, n };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { dest, n } = await load(params);
  const title = `${n} days in ${dest.name}: itinerary, map and where to eat`;
  const description = `A day-by-day ${n}-day ${dest.name} itinerary with timed stops, maps, where to stay, what to eat and what to steer clear of. Prices in CAD. Make it yours in one click.`;
  return {
    title,
    description,
    alternates: { canonical: guidePath(dest.slug, n) },
    openGraph: { title, description, type: "article", url: guidePath(dest.slug, n) },
  };
}

const TIER_LABEL = { shoestring: "Shoestring", comfort: "Comfort", luxury: "Luxury" } as const;

export default async function GuidePage({ params }: Props) {
  const { dest, n } = await load(params);
  const [rates, advisories] = await Promise.all([getRates(), loadAdvisories()]);
  const iso = COUNTRY_ISO[dest.country];
  const advisory = iso && iso !== HOME_ISO ? advisories.get(iso) : undefined;
  const fx: FxSnapshot = { currency: "CAD", rate: rates.rates.CAD, asOf: rates.asOf, source: rates.source };
  const trip = buildGuide(dest, n, fx);
  const money = (usd: number) => formatMoney(usd, fx, { approx: true });
  const food = FOOD[dest.slug];
  const others = DESTINATIONS.filter((d) => d.slug !== dest.slug && d.region === dest.region).slice(0, 6);
  const planHref = `/plan?${new URLSearchParams({ to: dest.name, nights: String(n - 1), tier: GUIDE_PLAN.budgetTier, interests: "culture,food", cur: "CAD" })}`;
  const stops = trip.days.flatMap((d) => d.activities.filter((a) => a.category !== "transit" && a.category !== "free"));

  const url = `${siteUrl()}${guidePath(dest.slug, n)}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "TouristTrip",
      name: `${n} days in ${dest.name}`,
      description: dest.tagline,
      url,
      touristType: ["Couples", "Friends", "Families"],
      itinerary: {
        "@type": "ItemList",
        itemListElement: stops.map((a, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "TouristAttraction", name: a.title, description: a.description, address: a.area ? `${a.area}, ${dest.name}` : dest.name } })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Trip guides", item: `${siteUrl()}/guides` },
        { "@type": "ListItem", position: 2, name: dest.name, item: `${siteUrl()}${guidePath(dest.slug, GUIDE_LENGTHS[1])}` },
        { "@type": "ListItem", position: 3, name: `${n} days`, item: url },
      ],
    },
  ];

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/guides" className="hover:text-ink">Trip guides</Link> <span aria-hidden="true">›</span> {dest.name}
      </nav>

      <header className="mt-4">
        <p className="eyebrow">{dest.country} · {n}-day itinerary</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{n} days in {dest.name}</h1>
        <p className="mt-3 text-lg text-ink-soft">{dest.tagline} Here&apos;s a {n}-day plan that clusters each day by neighbourhood, with real times, so you walk less and see more.</p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> Best: {monthsLabel(dest.bestMonths)}</span>
          <span className="inline-flex items-center gap-1.5"><Wallet className="h-4 w-4" /> About {formatMoney(dailyPerPerson(dest)[1].usd, fx)} per person a day (comfort)</span>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href={planHref} className="btn-primary"><Sparkles className="h-4 w-4" /> Make this trip mine</Link>
          <span className="text-sm text-muted">Pick your dates and who&apos;s going, then edit anything. Free.</span>
        </div>
        <nav aria-label="Other lengths" className="mt-5 flex flex-wrap gap-2">
          {guideLengths(dest).map((d) => (
            <Link key={d} href={guidePath(dest.slug, d)} aria-current={d === n ? "page" : undefined} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${d === n ? "bg-ink text-white" : "bg-sand text-ink-soft hover:text-ink"}`}>{d} days</Link>
          ))}
        </nav>
      </header>

      <section className="mt-10 space-y-10" aria-label="Day by day">
        {trip.days.map((day) => {
          const items = scheduleDay(trip, day);
          return (
            <section key={day.index} aria-labelledby={`day-${day.index + 1}`}>
              <p className="eyebrow">Day {day.index + 1}</p>
              <h2 id={`day-${day.index + 1}`} className="mt-1 font-display text-2xl font-semibold">{day.theme}</h2>
              <ol className="mt-4 space-y-3">
                {items.map((it) => {
                  if (it.kind === "meal") {
                    return (
                      <li key={`${it.label}-${it.start}`} className="flex items-center gap-3 pl-1 text-sm text-muted">
                        <UtensilsCrossed className="h-4 w-4 text-brand/70" /> <span className="font-semibold text-ink-soft">{clock(it.start)}</span> {it.label}{it.label === "Dinner" && day.eat ? ` · ${day.eat}` : ""}
                      </li>
                    );
                  }
                  const a = it.activity;
                  if (!a || it.kind !== "activity") return null;
                  const travel = a.category === "transit";
                  const ticket = a.bookable ? experienceLinks(dest.name, a.title, "CAD")[0] : undefined;
                  return (
                    <li key={a.id} className={`rounded-2xl border p-4 ${a.category === "free" ? "border-dashed border-line" : "border-line bg-surface"}`}>
                      <div className="flex gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold tracking-wide text-muted uppercase">{clock(it.start)} – {clock(it.end)}{a.area && !travel ? ` · ${a.area}` : ""}{a.estCost ? ` · ${money(a.estCost)}` : ""}</p>
                          <h3 className="mt-1 text-lg font-semibold">{a.title}</h3>
                          <p className="mt-1 text-ink-soft">{a.description}</p>
                          {a.tip && <p className="mt-2 flex gap-2 text-sm text-ink-soft"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{a.tip}</p>}
                          {!travel && a.category !== "free" && (
                            <p className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                              {ticket && <a href={trackedHref({ ...ticket, valueUSD: a.estCost })} rel="noopener noreferrer sponsored" target="_blank" className="inline-flex items-center gap-1 text-brand-dark hover:underline"><Ticket className="h-3.5 w-3.5" /> Tickets</a>}
                              <a href={trackedHref(reviewsLink(a.title, dest.name, "CAD"))} rel="noopener noreferrer" target="_blank" className="inline-flex items-center gap-1 text-ink-soft hover:text-ink"><Star className="h-3.5 w-3.5" /> Reviews</a>
                            </p>
                          )}
                        </div>
                        {!travel && a.category !== "free" && <PlacePhoto title={a.title} city={dest.name} durationHrs={a.durationHrs} className="h-20 w-24 sm:h-24 sm:w-32" />}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-3"><DayMapToggle trip={trip} day={day} items={items} /></div>
            </section>
          );
        })}
      </section>

      <section className="mt-14" aria-labelledby="stay-title">
        <h2 id="stay-title" className="flex items-center gap-2 font-display text-2xl font-semibold"><BedDouble className="h-5 w-5" /> Where to stay in {dest.name}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {(["shoestring", "comfort", "luxury"] as const).map((tier) => {
            const area = dest.areas[tier];
            const booking = stayLinks({ city: `${area.name}, ${dest.name}`, checkIn: "", checkOut: "", adults: 2, children: 0, currency: "CAD" }).find((l) => l.provider === "Booking.com")!;
            return (
              <li key={tier} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">{TIER_LABEL[tier]}</p>
                <p className="mt-1 font-semibold">{area.name}</p>
                <p className="mt-1 text-sm text-ink-soft">{area.why}</p>
                <a href={trackedHref(booking)} rel="noopener noreferrer sponsored" target="_blank" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-dark hover:underline">Hotels in {area.name} <ExternalLink className="h-3.5 w-3.5" /></a>
              </li>
            );
          })}
        </ul>
      </section>

      {food && (
        <section className="mt-14" aria-labelledby="eat-title">
          <h2 id="eat-title" className="flex items-center gap-2 font-display text-2xl font-semibold"><UtensilsCrossed className="h-5 w-5" /> What to eat in {dest.name}</h2>
          <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {food.dishes.slice(0, 6).map((d) => (
              <li key={d.name}><p className="font-semibold">{d.name}</p><p className="text-sm text-ink-soft">{d.what}</p></li>
            ))}
          </ul>
          <h3 className="mt-8 font-semibold">Where locals send visitors</h3>
          <ul className="mt-3 space-y-3">
            {food.restaurants.slice(0, 6).map((r) => (
              <li key={r.name} className="rounded-2xl border border-line bg-surface p-4">
                <p className="font-semibold">{r.name} <span className="font-semibold text-sea">{priceLabel(r.price)}</span></p>
                <p className="text-xs text-muted">{r.kind} · {r.area} · Best for {r.meal}{r.book ? " · Reserve ahead" : ""}</p>
                <p className="mt-1 text-sm text-ink-soft">{r.why}</p>
                <a href={trackedHref(reviewsLink(r.name, dest.name, "CAD"))} rel="noopener noreferrer" target="_blank" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink"><Star className="h-3.5 w-3.5" /> Reviews</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {advisory && (
        <section className="mt-14" aria-labelledby="advisory-title">
          <h2 id="advisory-title" className="mb-3 font-semibold">Official travel advice for Canadians</h2>
          <AdvisoryRows advisories={[advisory]} />
          <p className="mt-2 text-xs text-muted">From the {ADVISORY_SOURCE} (travel.gc.ca), refreshed every few hours. Always check before you go.</p>
        </section>
      )}

      <section className="mt-14 grid gap-6 lg:grid-cols-2">
        <HeadsUpCard cities={[dest.name]} />
        <div className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold"><Lightbulb className="h-4 w-4" /> Good to know</h2>
          <ul className="mt-4 space-y-3">
            {dest.tips.map((t) => <li key={t} className="flex gap-3 text-[15px] leading-relaxed text-ink-soft"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{t}</li>)}
          </ul>
          <h3 className="mt-6 flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4" /> Daily budget per person</h3>
          <table className="mt-2 w-full text-sm">
            <tbody className="divide-y divide-line">
              {dailyPerPerson(dest).map((t) => <tr key={t.tier}><td className="py-2">{TIER_LABEL[t.tier]}</td><td className="py-2 text-right font-semibold tabular-nums">{money(t.usd)}</td></tr>)}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">A shared double room, meals and local transport. Flights and tickets not included.</p>
        </div>
      </section>

      <section className="mt-14 rounded-3xl bg-ink p-6 text-white sm:p-8">
        <h2 className="font-display text-2xl font-semibold">Make this {dest.name} trip yours</h2>
        <p className="mt-2 text-white/75">Giro rebuilds this plan for your dates, your group and your budget. Swap stops, drag them between days, add your flights and hotel, and share it with everyone coming.</p>
        <Link href={planHref} className="btn-primary mt-5"><Sparkles className="h-4 w-4" /> Plan this trip</Link>
      </section>

      {others.length > 0 && (
        <nav className="mt-14" aria-labelledby="more-title">
          <h2 id="more-title" className="flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4" /> More guides nearby</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {others.map((d) => {
              const len = guideLengths(d).includes(n) ? n : GUIDE_LENGTHS[1];
              return <li key={d.slug}><Link href={guidePath(d.slug, len)} className="inline-block rounded-full border border-line px-3 py-1.5 text-sm hover:border-ink/30">{len} days in {d.name}</Link></li>;
            })}
          </ul>
        </nav>
      )}

      <p className="mt-10 text-xs text-muted">Times and prices are estimates (prices in CAD at {fx.source === "live" ? "the latest ECB rate" : "a built-in rate"}). Check opening hours before you go. Place descriptions and photos from Wikipedia and Wikimedia Commons, credited on each photo. Giro may earn a commission on bookings, at no extra cost to you.</p>
    </article>
  );
}
