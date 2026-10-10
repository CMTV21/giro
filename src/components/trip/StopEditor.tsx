"use client";

import { useState } from "react";
import { currencySymbol, type FxSnapshot } from "@/lib/currency";
import { cleanDraft, MAX_STOP_HOURS, type StopDraft } from "@/lib/plan-edit";
import { INTERESTS, type Activity, type Slot } from "@/lib/types";
import { CATEGORY_META } from "../meta";

const CATEGORIES: Activity["category"][] = [...INTERESTS, "free"];
const MINUTES = [0, 15, 30, 45];

/** One form for editing a stop and for adding your own. */
export function StopEditor({
  initial,
  fx,
  mode,
  shared,
  onSave,
  onCancel,
  compact,
}: {
  initial: StopDraft;
  fx: Pick<FxSnapshot, "currency" | "rate">;
  mode: "edit" | "add";
  /** Group trips: everyone on the trip sees notes. */
  shared?: boolean;
  onSave: (fields: Omit<Activity, "id">) => void;
  onCancel: () => void;
  /** Narrow layout for side panels (the board). */
  compact?: boolean;
}) {
  const [d, setD] = useState<StopDraft>(initial);
  const [error, setError] = useState<string>();
  const set = <K extends keyof StopDraft>(k: K, v: StopDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const hours = Math.floor(d.durationHrs);
  const minutes = Math.round((d.durationHrs - hours) * 60);

  return (
    <form
      className={`grid gap-3 rounded-2xl border border-ink/10 bg-sand/60 p-4 ${compact ? "" : "mb-5 ml-14"}`}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      onSubmit={(e) => {
        e.preventDefault();
        const r = cleanDraft(d, fx.rate);
        if (!r.ok) return setError(r.error);
        onSave(r.fields);
      }}
    >
      <p className="text-sm font-semibold">{mode === "add" ? "Add your own stop" : "Edit stop"}</p>
      <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-[2fr_1fr]"}`}>
        <input autoFocus className="field py-2" placeholder="What do you want to do?" aria-label="Stop name" value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={160} />
        <input className="field py-2" placeholder="Area or address (optional)" aria-label="Area" value={d.area} onChange={(e) => set("area", e.target.value)} maxLength={120} />
      </div>
      <div className={`grid grid-cols-2 gap-3 ${compact ? "" : "sm:grid-cols-4"}`}>
        <label className="text-xs font-medium text-muted">
          Type
          <select className="field mt-1 py-2" value={d.category} onChange={(e) => set("category", e.target.value as Activity["category"])} disabled={d.category === "transit"}>
            {d.category === "transit" && <option value="transit">Travel</option>}
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Time of day
          <select className="field mt-1 py-2" value={d.slot} onChange={(e) => set("slot", e.target.value as Slot)}>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Starts at
          <input type="time" className="field mt-1 py-2" value={d.start} onChange={(e) => set("start", e.target.value)} aria-describedby="start-hint" />
        </label>
        <div className="text-xs font-medium text-muted">
          How long
          <div className="mt-1 flex gap-1.5">
            <select aria-label="Hours" className="field py-2" value={hours} onChange={(e) => set("durationHrs", Math.min(MAX_STOP_HOURS, Number(e.target.value) + minutes / 60))}>
              {Array.from({ length: MAX_STOP_HOURS + 1 }, (_, h) => <option key={h} value={h}>{h}h</option>)}
            </select>
            <select aria-label="Minutes" className="field py-2" value={MINUTES.includes(minutes) ? minutes : 0} onChange={(e) => set("durationHrs", Math.min(MAX_STOP_HOURS, hours + Number(e.target.value) / 60))} disabled={hours === MAX_STOP_HOURS}>
              {MINUTES.map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}m</option>)}
            </select>
          </div>
        </div>
      </div>
      <p id="start-hint" className="-mt-1 text-xs text-muted">Leave the start time empty and Giro fits it into the day. Changing how long it takes re-times everything after it.</p>
      <label className={`text-xs font-medium text-muted ${compact ? "" : "sm:max-w-48"}`}>
        Cost per adult ({fx.currency})
        <div className="relative mt-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">{currencySymbol(fx.currency)}</span>
          <input inputMode="decimal" className="field py-2 pl-8" value={d.costLocal || ""} placeholder="0" onChange={(e) => set("costLocal", Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)} />
        </div>
      </label>
      <textarea rows={2} className="field resize-none py-2" placeholder="Description (optional)" aria-label="Description" value={d.description} onChange={(e) => set("description", e.target.value)} maxLength={600} />
      <div>
        <textarea rows={2} className="field resize-none py-2" placeholder="Your note: booking reference, who's meeting where, what to bring…" aria-label="Note" value={d.note} onChange={(e) => set("note", e.target.value)} maxLength={500} />
        <p className="mt-1 text-xs text-muted">{shared ? "Everyone on this trip can see notes." : "Notes are saved with the trip and appear in the printable guide."}</p>
      </div>
      {error && <p className="text-sm font-medium text-brand-dark" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-dark py-2">{mode === "add" ? "Add stop" : "Save"}</button>
        <button type="button" className="btn-ghost py-2" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
