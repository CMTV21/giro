import { ArrowRight, CalendarDays, Layers, Map, Shuffle, SlidersHorizontal, Sparkles, Ticket, Wallet } from "lucide-react";
import Link from "next/link";
import { DestinationCard } from "@/components/DestinationCard";
import { CATEGORY_META } from "@/components/meta";
import { QuickPlan } from "@/components/QuickPlan";
import { curateTrip } from "@/lib/curate";
import { DESTINATIONS } from "@/lib/destinations";

const PARTNERS = ["Google Flights", "Expedia", "Airbnb", "Booking.com", "Skyscanner", "Kayak", "Vrbo", "GetYourGuide", "Viator"];

const SIMPLE = [
  { icon: Sparkles, title: "Five questions, one great trip", body: "Where, when, who, what you love and your budget. That's it." },
  { icon: Map, title: "Days that make geographic sense", body: "Stops are clustered by neighbourhood so you spend time there, not in transit." },
  { icon: Ticket, title: "Book in one tap", body: "Flights, stays and tickets open pre-filled with your dates on the sites you already trust." },
];

const ADVANCED = [
  { icon: Layers, title: "Multi-city routing", body: "Split nights across up to six cities with transfer days and open-jaw flights." },
  { icon: Shuffle, title: "Swap, reorder, add", body: "Don't love a stop? Swap it for a curated alternative or drop in your own." },
  { icon: Wallet, title: "Live budget", body: "A breakdown that updates as you edit, measured against your target." },
  { icon: SlidersHorizontal, title: "Pace, stay style, must-sees", body: "Fine-tune the rhythm of every day and what makes the cut." },
  { icon: CalendarDays, title: "Calendar & print", body: "Export every activity to your calendar, or print a clean PDF." },
  { icon: Sparkles, title: "Giro AI", body: "Claude researches any destination on earth and hand-picks real places." },
];

export default function Home() {
  // A real sample, rendered at build time by the same engine travellers use.
  const sample = curateTrip({
    destinations: ["Lisbon"],
    origin: "",
    startDate: "2027-05-14",
    endDate: "2027-05-18",
    adults: 2,
    children: 0,
    budgetTier: "comfort",
    pace: "balanced",
    interests: ["food", "history", "culture"],
    stayType: "boutique",
  });
  const day = sample.days.find((d) => d.index > 0 && d.activities.length >= 3) ?? sample.days[1];

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="bg-grain absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="eyebrow">Trip planning, reimagined</p>
            <h1 className="mt-4 font-display text-5xl leading-[0.98] font-semibold tracking-tight sm:text-7xl">
              Trips,<br />
              <span className="text-brand italic">curated</span> for you.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-soft">
              Tell Giro where and when. Get a day-by-day plan shaped around how you like to travel, with flights, stays and tickets ready to book on Google Flights, Airbnb, Booking.com and Expedia.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/plan" className="btn-primary px-6 py-3.5 text-base">Start planning <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/explore" className="btn-ghost px-6 py-3.5 text-base">Find inspiration</Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rotate-3 rounded-[2.5rem] bg-gradient-to-br from-brand/20 via-transparent to-sea/20 blur-2xl" />
            <div className="card overflow-hidden">
              <div className="px-5 py-4 text-white" style={{ background: `linear-gradient(135deg, ${sample.palette[0]}, ${sample.palette[1]} 140%)` }}>
                <p className="text-xs font-semibold tracking-[0.16em] text-white/70 uppercase">Day {day.index + 1} · {day.city}</p>
                <p className="font-display text-xl font-semibold">{day.theme}</p>
              </div>
              <ul className="divide-y divide-line">
                {day.activities.map((a) => {
                  const meta = CATEGORY_META[a.category];
                  const Icon = meta.icon;
                  return (
                    <li key={a.id} className="flex gap-3 px-5 py-3.5">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${meta.tone}`}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold tracking-wide text-muted uppercase">{a.slot} · {a.area}</span>
                        <span className="block truncate font-semibold">{a.title}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between border-t border-line bg-sand/50 px-5 py-3 text-sm">
                <span className="text-muted">Stay: {sample.stays[0].area}</span>
                <span className="font-semibold text-brand">Book →</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <QuickPlan />
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 sm:px-6">
          <span className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">Book with</span>
          {PARTNERS.map((p) => <span key={p} className="text-[15px] font-semibold text-ink-soft/80">{p}</span>)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Simple by default</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">A plan in seconds.</h2>
            <div className="mt-8 space-y-6">
              {SIMPLE.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-ink-soft">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow text-sea!">Advanced when you want it</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">Every detail, yours.</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {ADVANCED.map(({ icon: Icon, title, body }) => (
                <div key={title} className="card p-5">
                  <Icon className="h-5 w-5 text-sea" />
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Where to next</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">Start with a favourite.</h2>
          </div>
          <Link href="/explore" className="hidden text-sm font-semibold text-ink-soft hover:text-ink sm:block">All destinations →</Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DESTINATIONS.slice(0, 4).map((d) => <DestinationCard key={d.slug} d={d} size="lg" />)}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-center text-white sm:px-12">
          <div className="bg-grain absolute inset-0 opacity-20" />
          <div className="relative">
            <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your next trip is five questions away.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">Free to plan. Book on the sites you already trust.</p>
            <Link href="/plan" className="btn-primary mt-8 px-7 py-3.5 text-base">Plan my trip <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
