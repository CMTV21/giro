import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AFFILIATES } from "@/lib/affiliates";
import { SESSION_COOKIE, userFromToken } from "@/server/auth";
import { revenueReport } from "@/server/clicks";

export const metadata: Metadata = { title: "Partner revenue", robots: { index: false } };
export const dynamic = "force-dynamic";

const usd = (n: number, digits = 0) => `US$${n.toLocaleString("en-CA", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

// Read literally so Next.js inlines them; a configured ID means clicks can earn.
const CONFIGURED: Record<string, boolean> = {
  NEXT_PUBLIC_BOOKING_AID: Boolean(process.env.NEXT_PUBLIC_BOOKING_AID),
  NEXT_PUBLIC_EXPEDIA_AFFCID: Boolean(process.env.NEXT_PUBLIC_EXPEDIA_AFFCID),
  NEXT_PUBLIC_SKYSCANNER_ASSOCIATE_ID: Boolean(process.env.NEXT_PUBLIC_SKYSCANNER_ASSOCIATE_ID),
  NEXT_PUBLIC_GETYOURGUIDE_PARTNER_ID: Boolean(process.env.NEXT_PUBLIC_GETYOURGUIDE_PARTNER_ID),
  NEXT_PUBLIC_VIATOR_PID: Boolean(process.env.NEXT_PUBLIC_VIATOR_PID),
};

export default async function RevenuePage() {
  const user = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user?.isAdmin) notFound();
  const { rows, daily } = await revenueReport(30);
  const totals = rows.reduce((t, r) => ({ clicks: t.clicks + r.clicks, value: t.value + r.valueUSD, expected: t.expected + r.expectedUSD }), { clicks: 0, value: 0, expected: 0 });
  // A fixed 30-day axis, so quiet days show as gaps rather than stretching the busy ones.
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    return byDay.get(day) ?? { day, clicks: 0, expectedUSD: 0 };
  });
  const peak = Math.max(0.01, ...days.map((d) => d.expectedUSD));

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <p className="eyebrow">Admin · last 30 days</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Partner revenue</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">Every outbound booking click goes through <code className="rounded bg-sand px-1">/go</code>. Projections multiply the trip value behind each click by assumed conversion and commission rates. Reconcile with partner dashboards using the <code className="rounded bg-sand px-1">giro-…</code> sub-IDs.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Partner clicks" value={totals.clicks.toLocaleString("en-CA")} />
        <Stat label="Trip value sent to partners" value={usd(totals.value)} />
        <Stat label="Projected commission" value={usd(totals.expected, 2)} strong />
      </div>

      <section className="card p-5 sm:p-6" aria-labelledby="daily-title">
        <h2 id="daily-title" className="font-semibold">Projected commission per day</h2>
        {daily.length ? (
          <div className="mt-6 flex h-40 items-end gap-[2px] border-b border-line" role="img" aria-label={days.filter((d) => d.clicks).map((d) => `${d.day}: ${usd(d.expectedUSD, 2)}`).join(", ")}>
            {days.map((d) => (
              <div key={d.day} className="group relative h-full flex-1">
                <div className="absolute inset-x-0 bottom-0 rounded-t-[4px] bg-[#2a78d6]" style={{ height: d.expectedUSD > 0 ? `${Math.max(3, (d.expectedUSD / peak) * 100)}%` : 0 }} />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block">{d.day} · {d.clicks} clicks · {usd(d.expectedUSD, 2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No partner clicks yet.</p>
        )}
      </section>

      <section className="card overflow-x-auto p-5 sm:p-6">
        <h2 className="font-semibold">By partner</h2>
        <table className="mt-4 w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase">
              <th className="pb-2 font-semibold">Partner</th>
              <th className="pb-2 font-semibold">Program</th>
              <th className="pb-2 text-right font-semibold">Clicks</th>
              <th className="pb-2 text-right font-semibold">Trip value</th>
              <th className="pb-2 text-right font-semibold">Projected</th>
              <th className="pb-2 text-right font-semibold">Partner ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {AFFILIATES.filter((a) => a.provider !== "Google Maps").map((a) => {
              const r = rows.find((x) => x.provider === a.provider);
              const model = a.commission.model === "percent" ? `${a.commission.rate * 100}% × ${a.assumedConversion * 100}% conv.` : a.commission.model === "per_click" ? `US$${a.commission.usd}/click` : "No commission";
              return (
                <tr key={a.provider}>
                  <td className="py-3 font-medium">{a.provider}</td>
                  <td className="py-3 text-xs text-muted">{a.program}<br />{model}</td>
                  <td className="py-3 text-right tabular-nums">{r?.clicks ?? 0}</td>
                  <td className="py-3 text-right tabular-nums">{usd(r?.valueUSD ?? 0)}</td>
                  <td className="py-3 text-right font-semibold tabular-nums">{usd(r?.expectedUSD ?? 0, 2)}</td>
                  <td className="py-3 text-right text-xs">{a.idEnv ? (CONFIGURED[a.idEnv] ? <span className="text-sea">Configured</span> : <span className="text-brand-dark">Missing</span>) : <span className="text-muted">n/a</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-4 text-xs text-muted">Commission and conversion rates are illustrative defaults in <code>src/lib/affiliates.ts</code>. Replace them with your contracted terms.</p>
      </section>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${strong ? "border-ink bg-ink text-white" : "border-line bg-surface"}`}>
      <p className={`text-xs font-semibold tracking-wide uppercase ${strong ? "text-white/60" : "text-muted"}`}>{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
