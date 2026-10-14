import { CarTaxiFront, Footprints, TrainFront } from "lucide-react";
import type { HopAdvice } from "@/lib/getting-around";

const ICON = { walk: Footprints, transit: TrainFront, taxi: CarTaxiFront } as const;

/** The leg between two stops: how long, the best way to make it, and a directions link. */
export function TravelHop({ hop }: { hop: HopAdvice }) {
  const Icon = ICON[hop.mode];
  return (
    <div className="-mt-1 mb-3 ml-[3.25rem] flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted sm:ml-14">
      <Icon className="h-3.5 w-3.5 shrink-0 text-sea" aria-hidden />
      <span title={hop.estimated ? "Estimated from distance. Check live directions on the day." : "Measured route"}>
        <span className="font-semibold text-ink-soft">{hop.label}</span>
        {hop.km !== undefined && <> · {hop.km < 1 ? `${Math.round(hop.km * 1000 / 50) * 50} m` : `${hop.km.toFixed(1)} km`}</>}
        {hop.alt && <> · {hop.alt}</>}
      </span>
      <a href={hop.directionsUrl} target="_blank" rel="noopener noreferrer" className="no-print font-semibold text-brand hover:underline">
        Directions
      </a>
    </div>
  );
}
