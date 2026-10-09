import { BedDouble, Car, ExternalLink, Plane, Ticket } from "lucide-react";
import { experienceLinks, tripBookingLinks, type BookingLink } from "@/lib/booking";
import { formatDate } from "@/lib/dates";
import { resolveDestination } from "@/lib/curate";
import type { Trip } from "@/lib/types";

const STAY_FILTER: Record<Trip["request"]["budgetTier"], number | undefined> = { shoestring: 150, comfort: 350, luxury: undefined };

export function BookPanel({ trip }: { trip: Trip }) {
  const req = trip.request;
  const links = tripBookingLinks(
    req,
    trip.stays.map((s) => ({ city: s.city, checkIn: s.checkIn, checkOut: s.checkOut, maxNightly: STAY_FILTER[req.budgetTier] })),
  );
  const bookable = trip.days.flatMap((d) => d.activities.filter((a) => a.bookable).map((a) => ({ ...a, city: d.city, date: d.date })));

  return (
    <div className="space-y-10">
      <Group icon={<Plane className="h-5 w-5" />} title="Flights" subtitle={req.origin ? `For ${req.adults + req.children} traveller${req.adults + req.children > 1 ? "s" : ""}, dates pre-filled.` : "Add a departure city in the planner to search flights."}>
        {links.flights.length ? (
          links.flights.map((g) => (
            <div key={g.title} className="space-y-3">
              <p className="text-sm font-semibold text-ink-soft">{g.title}</p>
              <LinkGrid links={g.links} />
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-5 text-sm text-muted">No departure city yet.</p>
        )}
      </Group>

      <Group icon={<BedDouble className="h-5 w-5" />} title="Stays" subtitle="Searches open with your dates, party size and a price filter that matches your budget.">
        {links.stays.map((leg) => {
          const stay = trip.stays.find((s) => s.city === leg.city && s.checkIn === leg.checkIn);
          return (
            <div key={`${leg.city}-${leg.checkIn}`} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{leg.city} · {formatDate(leg.checkIn)} – {formatDate(leg.checkOut)}</p>
                {stay && <p className="text-xs text-muted">{stay.nights} night{stay.nights > 1 ? "s" : ""}</p>}
              </div>
              {stay && (
                <p className="rounded-xl bg-sea-soft px-4 py-3 text-sm text-ink-soft">
                  <span className="font-semibold text-sea">Stay in {stay.area}.</span> {stay.why}
                </p>
              )}
              <LinkGrid links={stay ? leg.links.map((l) => ({ ...l, url: withArea(l, stay.area, leg.city) })) : leg.links} />
            </div>
          );
        })}
      </Group>

      <Group icon={<Ticket className="h-5 w-5" />} title="Tickets & experiences" subtitle={bookable.length ? `${bookable.length} stops on your plan are worth booking ahead.` : "Browse tours and skip-the-line tickets."}>
        {bookable.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {bookable.map((a) => {
              const [gyg, viator] = experienceLinks(a.city, a.title);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.title} {a.booked && <span className="ml-1 text-xs font-medium text-sea">· Booked</span>}</p>
                    <p className="text-xs text-muted">{formatDate(a.date)} · {a.city}{a.estCost ? ` · ~$${a.estCost} pp` : ""}</p>
                  </div>
                  <a className="btn-ghost px-3 py-1.5 text-xs" href={gyg.url} target="_blank" rel="noopener noreferrer sponsored">GetYourGuide</a>
                  <a className="btn-ghost px-3 py-1.5 text-xs" href={viator.url} target="_blank" rel="noopener noreferrer sponsored">Viator</a>
                </li>
              );
            })}
          </ul>
        )}
        {links.experiences.map((e) => (
          <div key={e.city} className="space-y-3">
            <p className="text-sm font-semibold text-ink-soft">More in {e.city}</p>
            <LinkGrid links={e.links} />
          </div>
        ))}
      </Group>

      <Group icon={<Car className="h-5 w-5" />} title="Car rental" subtitle={carAdvice(trip)}>
        <LinkGrid links={links.cars} />
      </Group>

      <p className="text-xs text-muted">
        Giro links you to partner sites to complete your booking. Prices and availability are set by each partner. Giro may earn a commission at no extra cost to you.
      </p>
    </div>
  );
}

/** Airbnb and Booking.com support searching a neighbourhood; bias the search to Giro's recommended area. */
function withArea(link: BookingLink, area: string, city: string): string {
  const cleanArea = area.replace(/\(.*?\)/g, "").split("/")[0].trim();
  if (!cleanArea || cleanArea.toLowerCase().startsWith(city.toLowerCase())) return link.url;
  const url = new URL(link.url);
  if (link.provider === "Booking.com") url.searchParams.set("ss", `${cleanArea}, ${city}`);
  else if (link.provider === "Airbnb") url.pathname = `/s/${encodeURIComponent(`${cleanArea}, ${city}`)}/homes`;
  else return link.url;
  return url.toString();
}

function carAdvice(trip: Trip): string {
  const carFriendly = new Set(["reykjavik", "cape-town", "bali"]);
  const anyCar = trip.stays.some((s) => carFriendly.has(resolveDestination(s.city).slug));
  return anyCar ? "Recommended. This trip has scenic drives and day trips that are easiest by car." : "Usually unnecessary in the city. Consider one only for day trips.";
}

function Group({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white">{icon}</span>
        <div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

const PROVIDER_STYLE: Record<string, string> = {
  "Google Flights": "#1a73e8",
  Expedia: "#191e3b",
  Skyscanner: "#0770e3",
  Kayak: "#ff690f",
  Airbnb: "#ff385c",
  "Booking.com": "#003b95",
  Vrbo: "#1e3aa8",
  GetYourGuide: "#ff5533",
  Viator: "#186b6d",
};

function LinkGrid({ links }: { links: BookingLink[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {links.map((l) => (
        <li key={l.provider + l.label}>
          <a href={l.url} target="_blank" rel="noopener noreferrer sponsored" className="card group flex h-full items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: PROVIDER_STYLE[l.provider] ?? "#0b1220" }}>
              {l.provider.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[15px] font-semibold">{l.label} <ExternalLink className="h-3.5 w-3.5 text-muted transition group-hover:text-ink" /></span>
              <span className="mt-0.5 block text-xs text-muted">{l.provider} · {l.blurb}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
