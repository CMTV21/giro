import { BadgeAlert, CarTaxiFront, ExternalLink, Gavel, ShieldAlert, Wallet } from "lucide-react";
import { HEADS_UP, HEADS_UP_REVIEWED, OFFICIAL_ADVICE_URL, type HeadsUpKind } from "@/data/heads-up";
import { findDestination } from "@/lib/destinations";

const KIND: Record<HeadsUpKind, { label: string; icon: typeof BadgeAlert }> = {
  scam: { label: "Scam", icon: BadgeAlert },
  pickpockets: { label: "Pickpockets", icon: Wallet },
  transport: { label: "Getting around", icon: CarTaxiFront },
  safety: { label: "Safety", icon: ShieldAlert },
  rules: { label: "Local rules", icon: Gavel },
};

/** Heads-up notes for the catalog cities in a trip. */
export function headsUpFor(cities: string[]) {
  return [...new Set(cities)]
    .map((city) => {
      const d = findDestination(city);
      return d && HEADS_UP[d.slug] ? { city: d.name, country: d.country, items: HEADS_UP[d.slug] } : undefined;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
}

export function HeadsUpCard({ cities, compact }: { cities: string[]; compact?: boolean }) {
  const groups = headsUpFor(cities);
  if (!groups.length) return null;
  const abroad = groups.some((g) => g.country !== "Canada");
  return (
    <section className={compact ? "break-inside-avoid" : "card p-5 sm:p-6"} aria-labelledby="heads-up-title">
      <h3 id="heads-up-title" className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" /> Heads-up: what to steer clear of</h3>
      {groups.map((g) => (
        <div key={g.city} className="mt-4">
          {groups.length > 1 && <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{g.city}</p>}
          <ul className="space-y-3">
            {g.items.map((h) => {
              const { label, icon: Icon } = KIND[h.kind];
              return (
                <li key={h.text} className="flex gap-3 text-[15px] leading-relaxed text-ink-soft">
                  <Icon className="mt-1 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                  <span><span className="font-semibold text-ink">{label}:</span> {h.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="mt-4 text-xs text-muted">
        Giro&apos;s notes, reviewed {HEADS_UP_REVIEWED}. Things change, so check current advice before you go
        {abroad && (
          <>
            {": "}
            <a href={OFFICIAL_ADVICE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-ink-soft hover:text-ink">Government of Canada travel advisories <ExternalLink className="h-3 w-3" /></a>
          </>
        )}
        .
      </p>
    </section>
  );
}
