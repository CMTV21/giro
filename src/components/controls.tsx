"use client";

import { Minus, Plus } from "lucide-react";

export function Stepper({ label, hint, value, min, max, onChange }: { label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3">
      <div>
        <p className="text-[15px] font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} className="grid h-8 w-8 place-items-center rounded-full border border-line transition hover:border-ink/40 disabled:opacity-30" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-5 text-center text-[15px] font-semibold tabular-nums" aria-live="polite">{value}</span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} className="grid h-8 w-8 place-items-center rounded-full border border-line transition hover:border-ink/40 disabled:opacity-30" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-xl border px-3 py-3 text-left transition ${active ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-ink/30"}`}
          >
            <span className="block text-sm font-semibold">{o.label}</span>
            {o.hint && <span className={`mt-0.5 block text-xs ${active ? "text-white/70" : "text-muted"}`}>{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${checked ? "bg-brand" : "bg-line"}`}
    >
      <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}
