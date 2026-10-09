import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Destination } from "@/lib/destinations";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function DestinationCard({ d, size = "md" }: { d: Destination; size?: "md" | "lg" }) {
  const [a, b] = d.palette;
  const best = d.bestMonths.slice(0, 4).map((m) => MONTHS[m - 1]).join(" · ");
  return (
    <Link
      href={`/plan?to=${encodeURIComponent(d.name)}`}
      className={`group relative flex flex-col justify-end overflow-hidden rounded-3xl p-5 text-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift ${size === "lg" ? "min-h-80" : "min-h-64"}`}
      style={{ background: `linear-gradient(160deg, ${a} 0%, ${b} 130%)` }}
    >
      <span className="bg-grain absolute inset-0 opacity-40 mix-blend-overlay" />
      <span className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl transition duration-500 group-hover:scale-125" />
      <span className="absolute top-5 right-5 grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur transition group-hover:bg-white group-hover:text-ink">
        <ArrowUpRight className="h-4 w-4" />
      </span>
      <span className="relative">
        <span className="block text-xs font-semibold tracking-[0.16em] text-white/70 uppercase">{d.country}</span>
        <span className="mt-1 block font-display text-3xl leading-tight font-semibold">{d.name}</span>
        <span className="mt-1.5 block text-sm text-white/85">{d.tagline}</span>
        {best && <span className="mt-3 block text-xs text-white/65">Best: {best}</span>}
      </span>
    </Link>
  );
}
