"use client";

import { Ban, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { catalogStop } from "@/lib/destinations";
import { emptyTaste, withBlocked, type TasteProfile } from "@/lib/taste";
import { loadTaste, saveTaste } from "@/lib/taste-client";
import { INTERESTS, type Interest } from "@/lib/types";
import { INTEREST_META } from "./meta";

// Diverging pair (blue = drawn to, red = steers away) around a neutral zero line; every bar is also labelled in words.
const MORE = "#2a78d6";
const LESS = "#d64545";
const LIMIT = 5;

const describe = (w: number) => (w >= 2.5 ? "Loves" : w >= 0.8 ? "Leans toward" : w <= -2.5 ? "Avoids" : w <= -0.8 ? "Leans away" : "Neutral");

export function TasteDNA() {
  const [taste, setTaste] = useState<TasteProfile>();
  useEffect(() => setTaste(loadTaste()), []);
  if (!taste) return <div className="h-64 animate-pulse rounded-2xl bg-sand" />;

  const rows = [...INTERESTS].sort((a, b) => (taste.weights[b] ?? 0) - (taste.weights[a] ?? 0));
  const learning = taste.events < 8;

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="dna-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="dna-title" className="text-lg font-semibold">Your travel DNA</h2>
          <p className="mt-0.5 text-sm text-muted">
            Learned from what you swap, remove, book and vote on. {taste.events ? `${taste.events} signal${taste.events > 1 ? "s" : ""} so far.` : "Edit a few itineraries and it starts to fill in."}
            {learning && taste.events > 0 && " Still learning, so it only nudges your plans gently."}
          </p>
        </div>
        {taste.events > 0 && (
          <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => { const fresh = { ...emptyTaste(), blocked: taste.blocked }; saveTaste(fresh); setTaste(fresh); }}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>
      <ul className="mt-5 space-y-2.5">
        {rows.map((k: Interest) => {
          const w = taste.weights[k] ?? 0;
          const pct = (Math.min(LIMIT, Math.abs(w)) / LIMIT) * 50;
          const Icon = INTEREST_META[k].icon;
          return (
            <li key={k} className="grid grid-cols-[8.5rem_1fr_6.5rem] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_7rem]">
              <span className="flex items-center gap-2 truncate font-medium"><Icon className="h-4 w-4 shrink-0 text-muted" /> {INTEREST_META[k].label}</span>
              <span className="relative h-3 rounded-full bg-[#f0efec]" title={`${INTEREST_META[k].label}: ${describe(w)}`}>
                <span className="absolute top-[-3px] bottom-[-3px] left-1/2 w-px bg-ink/25" aria-hidden="true" />
                {w !== 0 && (
                  <span
                    className="absolute top-0 h-full"
                    style={{ background: w > 0 ? MORE : LESS, width: `${pct}%`, left: w > 0 ? "50%" : `${50 - pct}%`, borderRadius: w > 0 ? "0 4px 4px 0" : "4px 0 0 4px" }}
                  />
                )}
              </span>
              <span className="text-right text-xs text-muted">{describe(w)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-muted">Giro uses this to break ties when curating and suggesting swaps. Your explicit choices in the planner always win.</p>
      {(taste.blocked?.length ?? 0) > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Ban className="h-4 w-4" /> Hidden suggestions</h3>
          <p className="mt-0.5 text-xs text-muted">Giro won&apos;t suggest these again in new plans, swaps or Ideas.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {taste.blocked!.map((key) => {
              const stop = catalogStop(key);
              return (
                <li key={key} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-1 pr-1 pl-3 text-sm">
                  {stop ? `${stop.title} · ${stop.city}` : key}
                  <button type="button" aria-label={`Suggest ${stop?.title ?? key} again`} title="Suggest again" onClick={() => { const next = withBlocked(taste, key, false); saveTaste(next); setTaste(next); }} className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"><X className="h-3.5 w-3.5" /></button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
