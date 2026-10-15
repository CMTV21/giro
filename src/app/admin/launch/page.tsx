import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SESSION_COOKIE, userFromToken } from "@/server/auth";
import { launchScorecard, type Metric, type Verdict } from "@/server/funnel";

export const metadata: Metadata = { title: "Launch scorecard", robots: { index: false } };
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

/** Day 0 of the experiment: ?since=, else LAUNCH_DATE, else 90 days ago. */
function startDate(param?: string): string {
  if (param && ISO.test(param)) return param;
  const env = process.env.LAUNCH_DATE?.trim();
  if (env && ISO.test(env)) return env;
  return new Date(Date.now() - 90 * DAY).toISOString().slice(0, 10);
}

const VERDICT: Record<Verdict, { label: string; className: string }> = {
  go: { label: "Go", className: "bg-sea/15 text-sea" },
  iterate: { label: "Iterate", className: "bg-amber-100 text-amber-900" },
  stop: { label: "Stop", className: "bg-red-100 text-red-800" },
};

const show = (m: Metric, v: number) => (m.ratio ? `${Math.round(v * 100)}%` : v.toLocaleString("en-CA"));

export default async function LaunchPage({ searchParams }: { searchParams: Promise<{ since?: string }> }) {
  const user = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user?.isAdmin) notFound();
  const since = startDate((await searchParams).since);
  const { metrics, counts, decision } = await launchScorecard(since);
  const day = Math.max(0, Math.floor((Date.now() - Date.parse(`${since}T00:00:00Z`)) / DAY));

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <p className="eyebrow">Admin · since {since} · day {day} of 90</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Launch scorecard</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          The go/no-go metrics from <code className="rounded bg-sand px-1">docs/LAUNCH-90-DAY.md</code>. Set <code className="rounded bg-sand px-1">LAUNCH_DATE</code> in Vercel to fix day 0, or add <code className="rounded bg-sand px-1">?since=YYYY-MM-DD</code>. See also <Link href="/admin/revenue" className="font-semibold text-brand hover:underline">partner revenue</Link>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-5">
        <span className="text-sm font-semibold text-muted uppercase">If we decided today</span>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${VERDICT[decision].className}`}>{VERDICT[decision].label}</span>
        <span className="text-sm text-ink-soft">Go: 4 of 6 at Go and none at Stop. Stop: invite rate and both Pass numbers at Stop.</span>
      </div>

      <section className="card overflow-x-auto p-5 sm:p-6">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase">
              <th className="pb-2 font-semibold">Metric</th>
              <th className="pb-2 text-right font-semibold">Now</th>
              <th className="pb-2 text-right font-semibold">Go</th>
              <th className="pb-2 text-right font-semibold">Stop below</th>
              <th className="pb-2 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {metrics.map((m) => (
              <tr key={m.key}>
                <td className="py-3">
                  <span className="font-medium">{m.label}</span>
                  <br />
                  <span className="text-xs text-muted">{m.definition}</span>
                </td>
                <td className="py-3 text-right font-semibold tabular-nums">{show(m, m.value)}</td>
                <td className="py-3 text-right tabular-nums text-muted">≥ {show(m, m.go)}</td>
                <td className="py-3 text-right tabular-nums text-muted">{show(m, m.stop)}</td>
                <td className="py-3 text-right">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${VERDICT[m.verdict].className}`}>{VERDICT[m.verdict].label}</span>
                  {m.early && m.ratio && <span className="mt-1 block text-[11px] text-muted">Too early to judge</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Count label="Trips planned" value={counts.planned} />
        <Count label="Saved to accounts" value={counts.saved} />
        <Count label="Group trips (2+)" value={counts.groupTrips} />
        <Count label="Pass page views" value={counts.passViews} />
        <Count label="Pass waitlist" value={counts.waitlist} />
      </section>
      <p className="text-xs text-muted">Trips planned counts from when this tracking went live. Visitors (the funnel&apos;s top) are in Vercel → Analytics.</p>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value.toLocaleString("en-CA")}</p>
    </div>
  );
}
