"use client";

import { ArrowRight, Check, Copy, LogOut, Plus, Trash2, UserMinus, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CURRENCIES, formatLocal, isCurrency, type Currency } from "@/lib/currency";
import { tripFx } from "@/lib/money";
import { api, type TripBundle } from "@/lib/storage";
import { useSession } from "../SessionProvider";

export function GroupPanel({ bundle, onChanged, onSaveToAccount, onLeft }: { bundle: TripBundle; onChanged: () => void; onSaveToAccount: () => Promise<void>; onLeft: () => void }) {
  const { user } = useSession();
  const tripId = bundle.trip.id;

  if (!bundle.remote) {
    return (
      <div className="card mx-auto max-w-xl px-6 py-12 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand"><Users className="h-6 w-6" /></span>
        <h3 className="mt-4 font-display text-2xl font-semibold">Plan it together</h3>
        <p className="mt-2 text-ink-soft">Invite friends to vote on stops, edit the plan and split costs, with balances settled in as few transfers as possible.</p>
        {user ? (
          <SaveButton onSave={onSaveToAccount} />
        ) : (
          <Link href={`/login?next=${encodeURIComponent(`/trip/${tripId}`)}`} className="btn-primary mt-6">Sign in to invite friends <ArrowRight className="h-4 w-4" /></Link>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Members bundle={bundle} onChanged={onChanged} onLeft={onLeft} />
      <Expenses bundle={bundle} onChanged={onChanged} />
    </div>
  );
}

function SaveButton({ onSave }: { onSave: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="btn-primary mt-6" disabled={busy} onClick={async () => { setBusy(true); await onSave(); setBusy(false); }}>
      {busy ? "Saving…" : "Save to my account to share"}
    </button>
  );
}

function Members({ bundle, onChanged, onLeft }: { bundle: TripBundle; onChanged: () => void; onLeft: () => void }) {
  const [copied, setCopied] = useState<string>();
  const [error, setError] = useState<string>();
  const canInvite = bundle.role !== "viewer";
  const tripId = encodeURIComponent(bundle.trip.id);

  async function invite(role: "editor" | "viewer") {
    setError(undefined);
    try {
      const { path } = await api<{ path: string }>(`/api/trips/${tripId}/invites`, { method: "POST", body: JSON.stringify({ role }) });
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(role);
      setTimeout(() => setCopied(undefined), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create an invite.");
    }
  }

  async function remove(memberId: string) {
    const self = memberId === bundle.me;
    if (!confirm(self ? "Leave this trip?" : "Remove this person from the trip?")) return;
    try {
      await api(`/api/trips/${tripId}/members/${encodeURIComponent(memberId)}`, { method: "DELETE" });
      if (self) onLeft();
      else onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update members.");
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <h3 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Travellers</h3>
      <ul className="mt-4 divide-y divide-line">
        {bundle.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-3">
            <Avatar name={m.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{m.name}{m.id === bundle.me && <span className="text-muted"> (you)</span>}</p>
              <p className="text-xs text-muted capitalize">{m.role === "editor" ? "Can edit" : m.role === "viewer" ? "Can view, vote & log costs" : "Owner"}</p>
            </div>
            {m.role !== "owner" && (bundle.role === "owner" || m.id === bundle.me) && (
              <button type="button" onClick={() => remove(m.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink" aria-label={m.id === bundle.me ? "Leave trip" : `Remove ${m.name}`} title={m.id === bundle.me ? "Leave trip" : "Remove"}>
                {m.id === bundle.me ? <LogOut className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
              </button>
            )}
          </li>
        ))}
      </ul>
      {canInvite && (
        <div className="mt-4 rounded-2xl bg-sand/60 p-4">
          <p className="text-sm font-semibold">Invite with a link</p>
          <p className="mt-0.5 text-xs text-muted">Links expire after 14 days. Anyone with the link can join after signing in.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-dark py-2" onClick={() => invite("editor")}>{copied === "editor" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === "editor" ? "Link copied" : "Copy editor link"}</button>
            <button type="button" className="btn-ghost py-2" onClick={() => invite("viewer")}>{copied === "viewer" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === "viewer" ? "Link copied" : "Copy voter link"}</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-brand-dark">{error}</p>}
    </section>
  );
}

function Expenses({ bundle, onChanged }: { bundle: TripBundle; onChanged: () => void }) {
  const fx = tripFx(bundle.trip);
  const members = bundle.members;
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "Former member";
  const local = (usd: number) => formatLocal(usd * fx.rate, fx.currency);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const tripId = encodeURIComponent(bundle.trip.id);
  const spent = bundle.expenses.reduce((s, e) => s + e.amountUSD, 0);

  async function remove(expenseId: string) {
    try {
      await api(`/api/trips/${tripId}/expenses/${encodeURIComponent(expenseId)}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that expense.");
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4" /> Shared costs</h3>
        <span className="text-sm text-muted tabular-nums">{local(spent)} logged</span>
      </div>

      {bundle.settleUSD.length > 0 && (
        <div className="mt-4 rounded-2xl bg-sea-soft p-4">
          <p className="text-sm font-semibold text-sea">To settle up</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {bundle.settleUSD.map((t) => (
              <li key={`${t.from}-${t.to}`} className="flex items-center gap-2">
                <span className="font-medium">{name(t.from)}</span> <ArrowRight className="h-3.5 w-3.5 text-muted" /> <span className="font-medium">{name(t.to)}</span>
                <span className="ml-auto font-semibold tabular-nums">{local(t.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {members.length > 0 && bundle.expenses.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {members.map((m) => {
            const v = bundle.balancesUSD[m.id] ?? 0;
            return (
              <li key={m.id} className="rounded-xl border border-line px-3 py-2">
                <p className="truncate text-xs text-muted">{m.name}</p>
                <p className={`text-sm font-semibold tabular-nums ${v > 0.005 ? "text-sea" : v < -0.005 ? "text-brand-dark" : ""}`}>{v > 0.005 ? "+" : ""}{local(v)}</p>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <ExpenseForm bundle={bundle} onDone={(saved) => { setAdding(false); if (saved) onChanged(); }} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="btn-ghost mt-4 py-2"><Plus className="h-4 w-4" /> Log an expense</button>
      )}

      {bundle.expenses.length > 0 && (
        <ul className="mt-5 divide-y divide-line">
          {bundle.expenses.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.description}</p>
                <p className="text-xs text-muted">{name(e.paidBy)} paid · split {e.splitBetween.length} way{e.splitBetween.length > 1 ? "s" : ""}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{isCurrency(e.currency) ? formatLocal(e.amount, e.currency) : e.amount}</p>
                {e.currency !== fx.currency && <p className="text-xs text-muted tabular-nums">≈ {local(e.amountUSD)}</p>}
              </div>
              {(bundle.role === "owner" || e.createdBy === bundle.me || e.paidBy === bundle.me) && (
                <button type="button" aria-label={`Delete ${e.description}`} onClick={() => remove(e.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"><Trash2 className="h-4 w-4" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!bundle.expenses.length && !adding && <p className="mt-3 text-sm text-muted">Log deposits, dinners and tickets as you go. Giro works out who owes whom.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-brand-dark">{error}</p>}
    </section>
  );
}

function ExpenseForm({ bundle, onDone }: { bundle: TripBundle; onDone: (saved: boolean) => void }) {
  const fx = tripFx(bundle.trip);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(fx.currency);
  const [paidBy, setPaidBy] = useState(bundle.me ?? bundle.members[0]?.id ?? "");
  const [among, setAmong] = useState<string[]>(bundle.members.map((m) => m.id));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-4 space-y-3 rounded-2xl border border-line bg-sand/40 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const value = Number(amount.replace(/,/g, ""));
        if (!(value > 0)) return setError("Enter an amount.");
        if (!among.length) return setError("Pick who it's split between.");
        setBusy(true);
        try {
          await api(`/api/trips/${encodeURIComponent(bundle.trip.id)}/expenses`, { method: "POST", body: JSON.stringify({ description, amount: value, currency, paidBy, splitBetween: among }) });
          onDone(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't save that.");
          setBusy(false);
        }
      }}
    >
      <input autoFocus className="field py-2" placeholder="What was it? e.g. Fado dinner" value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" maxLength={120} />
      <div className="flex gap-2">
        <input className="field py-2" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
        <select className="field w-28 py-2" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} aria-label="Currency">
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <label className="block text-sm">
        <span className="label">Paid by</span>
        <select className="field py-2" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          {bundle.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <fieldset>
        <legend className="label">Split between</legend>
        <div className="flex flex-wrap gap-2">
          {bundle.members.map((m) => (
            <button key={m.id} type="button" className="chip py-1.5" aria-pressed={among.includes(m.id)} onClick={() => setAmong(among.includes(m.id) ? among.filter((x) => x !== m.id) : [...among, m.id])}>
              {m.name}
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-brand-dark">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-dark py-2" disabled={busy}>{busy ? "Saving…" : "Add expense"}</button>
        <button type="button" className="btn-ghost py-2" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ${size === "sm" ? "h-6 w-6 text-[10px] ring-2 ring-surface" : "h-9 w-9 text-xs"}`} style={{ background: `hsl(${h} 45% 42%)` }} aria-hidden="true">
      {initials}
    </span>
  );
}
