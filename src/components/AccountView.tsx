"use client";

import { BarChart3, LogOut, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CURRENCIES, CURRENCY_NAMES } from "@/lib/currency";
import { AIRPORTS } from "@/lib/airports";
import { api } from "@/lib/storage";
import { useSession, type SessionUser } from "./SessionProvider";
import { TasteDNA } from "./TasteDNA";

export function AccountView() {
  const { user, signOut, setUser } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", homeCurrency: "CAD", homeAirport: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (user === null) router.replace("/login?next=/account");
    if (user) setForm({ name: user.name, homeCurrency: user.homeCurrency, homeAirport: user.homeAirport });
  }, [user, router]);

  if (!user) return <div className="h-96 animate-pulse rounded-3xl bg-sand" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-6">
        <form
          className="card space-y-4 p-5 sm:p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(undefined);
            try {
              const { user: u } = await api<{ user: SessionUser }>("/api/me", { method: "PATCH", body: JSON.stringify(form) });
              setUser(u);
              setSaved(true);
              setTimeout(() => setSaved(false), 1800);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't save.");
            }
          }}
        >
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted">{user.email}</p>
          <div>
            <label className="label" htmlFor="acct-name">Name</label>
            <input id="acct-name" className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
          </div>
          <div>
            <label className="label" htmlFor="acct-cur">Home currency</label>
            <select id="acct-cur" className="field" value={form.homeCurrency} onChange={(e) => setForm({ ...form, homeCurrency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c} · {CURRENCY_NAMES[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="acct-air">Home airport</label>
            <input id="acct-air" className="field" list="acct-airports" placeholder="e.g. YYZ or Toronto" value={form.homeAirport} onChange={(e) => setForm({ ...form, homeAirport: e.target.value })} maxLength={60} />
            <datalist id="acct-airports">{AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.city}</option>)}</datalist>
            <p className="mt-1.5 text-xs text-muted">Pre-fills flight searches and powers budget-first search.</p>
          </div>
          {error && <p role="alert" className="text-sm text-brand-dark">{error}</p>}
          <button type="submit" className="btn-dark">{saved ? "Saved" : "Save changes"}</button>
        </form>

        <div className="card space-y-3 p-5 sm:p-6">
          {user.isAdmin && (
            <Link href="/admin/revenue" className="btn-ghost w-full justify-start"><BarChart3 className="h-4 w-4" /> Partner revenue dashboard</Link>
          )}
          <button type="button" className="btn-ghost w-full justify-start" onClick={async () => { await signOut(); router.push("/"); }}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
          <button
            type="button"
            className="btn-ghost w-full justify-start text-brand-dark"
            onClick={async () => {
              if (!confirm("Delete your account? Trips you own are deleted for everyone, and this can't be undone.")) return;
              await api("/api/me", { method: "DELETE" });
              await signOut();
              router.push("/");
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete account
          </button>
        </div>
      </div>
      <TasteDNA />
    </div>
  );
}
