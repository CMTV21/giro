"use client";

import { CalendarDays, Check, Copy, Link2, Pencil, Printer, RefreshCw, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { curateTrip } from "@/lib/curate";
import { formatRange } from "@/lib/dates";
import { downloadFile, encodeTrip, tripToICS, tripToText } from "@/lib/export";
import { money, tripFx } from "@/lib/money";
import { planTrip } from "@/lib/plan-client";
import { api, ApiError, deleteTrip, fetchTrip, saveTrip, updateTrip, type TripBundle } from "@/lib/storage";
import { loadTaste } from "@/lib/taste-client";
import type { Trip } from "@/lib/types";
import { BUDGET_META, PACE_META } from "../meta";
import { useSession } from "../SessionProvider";
import { BookPanel } from "./BookPanel";
import { BudgetPanel } from "./BudgetPanel";
import { BookingsPanel } from "./BookingsPanel";
import { DayMapToggle } from "./DayMap";
import { FoodPanel } from "./FoodPanel";
import { ItineraryBoard } from "./ItineraryBoard";
import { PlaceFacts } from "./PlaceFacts";
import { Avatar, GroupPanel } from "./GroupPanel";
import { LivePanel } from "./LivePanel";
import { PackingPanel } from "./PackingPanel";

const TABS = [
  { id: "itinerary", label: "Itinerary" },
  { id: "food", label: "Eat & drink" },
  { id: "live", label: "Today" },
  { id: "book", label: "Book" },
  { id: "budget", label: "Budget" },
  { id: "group", label: "Group" },
  { id: "packing", label: "Packing & tips" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.id === v);

const NOTICES: Record<string, string> = {
  "ai-unavailable": "Giro AI isn't available right now, so this trip was curated instantly by the Giro engine.",
  "ai-failed": "Giro AI couldn't finish this one, so the Giro engine stepped in. You can try AI again with Regenerate.",
  joined: "You've joined this trip. Vote on stops, and log shared costs in the Group tab.",
};

const POLL_MS = 15_000;

export function editUrl(trip: Trip): string {
  const r = trip.request;
  const p = new URLSearchParams({
    to: r.destinations.join("|"),
    from: r.origin,
    start: r.startDate,
    end: r.endDate,
    adults: String(r.adults),
    children: String(r.children),
    interests: r.interests.join(","),
    cur: r.currency ?? "USD",
  });
  if (r.totalBudget) p.set("budget", String(r.totalBudget));
  if (r.destinations.length > 1 || r.totalBudget) p.set("mode", "advanced");
  return `/plan?${p.toString()}`;
}

export function TripView() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { user } = useSession();
  const [bundle, setBundle] = useState<TripBundle | null>();
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<Tab>(isTab(search.get("tab")) ? (search.get("tab") as Tab) : "itinerary");
  const [copied, setCopied] = useState<"text" | "link">();
  const [regenerating, setRegenerating] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [toast, setToast] = useState<string>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flash = useCallback((m: string) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(undefined), 7000);
  }, []);
  const notice = search.get("notice");

  // Saves run one at a time so each uses the version returned by the previous one.
  const latest = useRef<TripBundle | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);

  const load = useCallback(async () => {
    try {
      const b = await fetchTrip(id);
      latest.current = b ?? null;
      setBundle(b ?? null);
      setConflict(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setDenied(true);
      setBundle(null);
    }
  }, [id]);

  useEffect(() => {
    // Reload after signing in or out so account trips and their group data appear.
    load();
  }, [load, user?.id]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Collaborators' edits, votes and expenses appear without a manual refresh.
  useEffect(() => {
    if (!bundle?.remote || bundle.members.length < 2) return;
    const t = setInterval(async () => {
      if (pending.current > 0 || document.hidden) return;
      const fresh = await fetchTrip(id).catch(() => undefined);
      if (!fresh || pending.current > 0) return;
      const cur = latest.current;
      if (!cur || fresh.version >= cur.version) {
        latest.current = fresh;
        setBundle(fresh);
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [bundle?.remote, bundle?.members.length, id]);

  const commit = useCallback((next: Trip) => {
    const base = latest.current;
    if (!base) return;
    const optimistic = { ...base, trip: next };
    latest.current = optimistic;
    setBundle(optimistic);
    pending.current++;
    queue.current = queue.current.then(async () => {
      try {
        const current = latest.current!;
        const res = await updateTrip(current, current.trip);
        if ("conflict" in res) setConflict(true);
        else if (latest.current) latest.current = { ...latest.current, version: res.version };
        setSaveError(undefined);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Couldn't save your change.");
      } finally {
        pending.current--;
      }
    });
  }, []);

  if (bundle === undefined) return <div className="mx-auto h-[60vh] max-w-6xl animate-pulse px-4 py-10 sm:px-6"><div className="h-64 rounded-3xl bg-sand" /></div>;
  if (bundle === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold">{denied ? "This trip is private" : "Trip not found"}</h1>
        <p className="mt-2 text-muted">
          {denied ? "Ask the organiser for an invite link." : user ? "It may have been deleted, or it was planned in another browser before you signed in." : "Trips are saved in the browser you planned them in. Sign in to keep trips on every device."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {!user && <Link href={`/login?next=${encodeURIComponent(`/trip/${id}`)}`} className="btn-dark">Sign in</Link>}
          <Link href="/plan" className="btn-primary">Plan a new trip</Link>
        </div>
      </div>
    );
  }

  const trip = bundle.trip;
  const r = trip.request;
  const readOnly = bundle.role === "viewer";
  const shared = bundle.remote && bundle.members.length > 1;

  async function regenerate() {
    setRegenerating(true);
    let fresh: Trip;
    if (r.useAI) {
      // planTrip saves a new trip; keep the id of the one being regenerated instead.
      const res = await planTrip(r);
      fresh = res.trip;
      if (fresh.id !== trip.id) await deleteTrip({ remote: Boolean(user), trip: fresh }).catch(() => {});
    } else {
      fresh = curateTrip(r, { fx: tripFx(trip), taste: loadTaste() });
    }
    commit({ ...fresh, id: trip.id, createdAt: trip.createdAt, packed: trip.packed });
    setRegenerating(false);
  }

  async function copy(kind: "text" | "link") {
    try {
      const value = kind === "text" ? tripToText(trip) : `${window.location.origin}/shared#${await encodeTrip(trip)}`;
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(undefined), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  async function vote(activityId: string, value: -1 | 0 | 1) {
    const cur = latest.current;
    if (!cur) return;
    const prev = cur.votes[activityId] ?? { up: 0, down: 0, mine: 0 as const, upBy: [] };
    const me = cur.members.find((m) => m.id === cur.me)?.name ?? "You";
    const next = {
      up: prev.up - (prev.mine === 1 ? 1 : 0) + (value === 1 ? 1 : 0),
      down: prev.down - (prev.mine === -1 ? 1 : 0) + (value === -1 ? 1 : 0),
      mine: value,
      upBy: value === 1 ? [...prev.upBy.filter((n) => n !== me), me] : prev.upBy.filter((n) => n !== me),
    };
    const optimistic = { ...cur, votes: { ...cur.votes, [activityId]: next } };
    latest.current = optimistic;
    setBundle(optimistic);
    await api(`/api/trips/${encodeURIComponent(trip.id)}/votes`, { method: "PUT", body: JSON.stringify({ activityId, value }) }).catch(() => load());
  }

  async function moveToAccount() {
    const saved = await saveTrip(trip);
    if (saved.id === trip.id) await load();
    else router.replace(`/trip/${saved.id}?tab=group`);
  }

  const people = r.adults + r.children;
  const [c1, c2] = trip.palette;

  return (
    <div>
      <section className="relative overflow-hidden text-white" style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 120%)` }}>
        <div className="bg-grain absolute inset-0 opacity-40 mix-blend-overlay" />
        <div className="absolute -right-24 -bottom-40 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-10 sm:px-6 sm:pt-16">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
              {trip.source === "ai" ? <><Sparkles className="h-3.5 w-3.5" /> Curated by Giro AI</> : "Curated by Giro"}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">{formatRange(r.startDate, r.endDate)}</span>
            {shared && (
              <button type="button" onClick={() => setTab("group")} className="flex items-center rounded-full bg-white/15 py-0.5 pr-3 pl-1 backdrop-blur">
                <span className="flex -space-x-1.5">{bundle.members.slice(0, 4).map((m) => <Avatar key={m.id} name={m.name} size="sm" />)}</span>
                <span className="ml-2">{bundle.members.length} travellers</span>
              </button>
            )}
          </div>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">{trip.title}</h1>
          <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">{trip.summary}</p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            <span>{people} traveller{people > 1 ? "s" : ""}</span>
            <span>{trip.days.length} days</span>
            <span>{PACE_META[r.pace].label} pace</span>
            <span>{BUDGET_META[r.budgetTier].label}</span>
            <span className="font-semibold text-white">{money(trip, trip.budget.total, true)} total</span>
          </div>
          <div className="no-print mt-8 flex flex-wrap gap-2">
            <HeroBtn onClick={() => downloadFile(`${slug(trip.title)}.ics`, tripToICS(trip), "text/calendar")}><CalendarDays className="h-4 w-4" /> Add to calendar</HeroBtn>
            <HeroBtn onClick={() => copy("link")}>{copied === "link" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} {copied === "link" ? "Link copied" : "Share copy"}</HeroBtn>
            <HeroBtn onClick={() => copy("text")}>{copied === "text" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === "text" ? "Copied" : "Copy as text"}</HeroBtn>
            <Link href={`/trip/${trip.id}/guide`} className="btn border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20"><Printer className="h-4 w-4" /> Printable guide</Link>
            {!readOnly && <HeroBtn onClick={regenerate} disabled={regenerating}><RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} /> {regenerating ? "Re-curating…" : "Regenerate"}</HeroBtn>}
            <Link href={editUrl(trip)} className="btn border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20"><Pencil className="h-4 w-4" /> {readOnly ? "Plan my own version" : "Edit details"}</Link>
            {bundle.role === "owner" && (
              <HeroBtn
                onClick={async () => {
                  if (!confirm(shared ? "Delete this trip for everyone? This can't be undone." : "Delete this trip? This can't be undone.")) return;
                  await deleteTrip(bundle);
                  router.push("/trips");
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete trip</span>
              </HeroBtn>
            )}
          </div>
        </div>
      </section>

      {(conflict || saveError || (notice && NOTICES[notice]) || readOnly) && (
        <div className="no-print mx-auto mt-6 max-w-6xl space-y-2 px-4 sm:px-6">
          {conflict && (
            <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <TriangleAlert className="h-4 w-4 shrink-0" /> Someone else edited this trip at the same time, so your last change wasn&apos;t saved.
              <button type="button" onClick={load} className="ml-auto font-semibold underline">Load their version</button>
            </p>
          )}
          {saveError && <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{saveError}</p>}
          {notice && NOTICES[notice] && (
            <p className="flex items-start gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {NOTICES[notice]}
            </p>
          )}
          {readOnly && <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-soft">You can view this trip, vote on stops and log shared costs. Ask the owner for edit access to change the plan.</p>}
        </div>
      )}

      <div className="no-print sticky top-16 z-30 border-b border-line bg-paper/85 backdrop-blur-xl">
        <div role="tablist" aria-label="Trip sections" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`relative shrink-0 px-4 py-4 text-sm font-semibold transition ${tab === t.id ? "text-ink" : "text-muted hover:text-ink"}`}>
              {t.label}
              {t.id === "group" && shared && <span className="ml-1.5 rounded-full bg-sand px-1.5 py-0.5 text-[11px]">{bundle.members.length}</span>}
              {tab === t.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {tab === "itinerary" && (
          <div className="space-y-8">
            <BookingsPanel
              trip={trip}
              readOnly={readOnly}
              onChange={(c) => {
                commit(c.trip);
                if (c.message) flash(c.message);
              }}
            />
            <ItineraryBoard
              trip={trip}
              readOnly={readOnly}
              votes={shared ? bundle.votes : undefined}
              onVote={shared ? vote : undefined}
              onChange={commit}
              onMessage={flash}
              renderExtra={(a, city) => <PlaceFacts activity={a} city={city} />}
              renderMap={(day, items) => <DayMapToggle trip={trip} day={day} items={items} />}
            />
          </div>
        )}
        {tab === "food" && <FoodPanel trip={trip} readOnly={readOnly} onChange={commit} onMessage={flash} />}
        {tab === "live" && <LivePanel trip={trip} readOnly={readOnly} onChange={commit} />}
        {tab === "book" && <BookPanel trip={trip} />}
        {tab === "budget" && <BudgetPanel trip={trip} />}
        {tab === "group" && <GroupPanel bundle={bundle} onChanged={load} onSaveToAccount={moveToAccount} onLeft={() => router.push("/trips")} />}
        {tab === "packing" && <PackingPanel trip={trip} onChange={commit} />}
      </div>
      {toast && (
        <div role="status" className="no-print fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-lg items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lift sm:bottom-6">
          <span className="flex-1">{toast}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setToast(undefined)} className="font-semibold text-white/70 hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
}

function HeroBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20">
      {children}
    </button>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "giro-trip";
