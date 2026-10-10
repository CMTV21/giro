"use client";

import { Check, Copy, Inbox, Mail } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/storage";

interface InboxItem {
  id: string;
  sender: string;
  subject: string;
  status: "applied" | "pending" | "dismissed" | "empty" | "failed";
  summary: string;
  createdAt: string;
}

const RECENT_MS = 3 * 86_400_000;

/** "Forward confirmations to…" plus forwarded emails waiting for a member to add or dismiss. */
export function ForwardInbox({ tripId, readOnly, onApplied }: { tripId: string; readOnly: boolean; onApplied: (message: string) => void }) {
  const [data, setData] = useState<{ enabled: boolean; address?: string; items: InboxItem[] }>();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string>();

  const load = useCallback(async () => {
    try {
      setData(await api(`/api/trips/${encodeURIComponent(tripId)}/inbox`));
    } catch {
      setData(undefined);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
    // Pick up emails forwarded while the trip is open.
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // A newly applied email changed the saved trip; ask the page to reload it once.
  const [seenApplied, setSeenApplied] = useState<Set<string>>();
  useEffect(() => {
    if (!data) return;
    const applied = data.items.filter((i) => i.status === "applied" && Date.now() - Date.parse(i.createdAt) < RECENT_MS).map((i) => i.id);
    if (seenApplied) {
      const fresh = data.items.find((i) => applied.includes(i.id) && !seenApplied.has(i.id));
      if (fresh) onApplied(`From your forwarded email: ${fresh.summary}`);
    }
    setSeenApplied(new Set(applied));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data?.enabled) return null;
  const pending = data.items.filter((i) => i.status === "pending");
  const latest = data.items.find((i) => i.status !== "pending" && i.status !== "dismissed" && Date.now() - Date.parse(i.createdAt) < RECENT_MS);

  const resolve = async (item: InboxItem, action: "apply" | "dismiss") => {
    setBusy(item.id);
    try {
      const r = await api<{ status: InboxItem["status"] }>(`/api/trips/${encodeURIComponent(tripId)}/inbox`, { method: "POST", body: JSON.stringify({ itemId: item.id, action }) });
      if (r.status === "applied") onApplied(`Added from ${item.sender}'s email: ${item.summary}`);
      await load();
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="mt-4 rounded-2xl bg-sand/60 px-4 py-3">
      {data.address && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Mail className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="text-ink-soft">Forward booking emails to</span>
          <code className="min-w-0 truncate rounded-md bg-surface px-2 py-0.5 text-xs font-semibold">{data.address}</code>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink"
            onClick={async () => {
              await navigator.clipboard?.writeText(data.address!).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
          </button>
          <p className="basis-full pl-6 text-xs text-muted">Giro reads flights and stays and adds them here. From your account email they&apos;re added straight away; from other addresses they wait for you to approve.</p>
        </div>
      )}
      {latest && <p className="mt-2 pl-6 text-xs text-muted">Latest: “{latest.subject}”. {latest.summary}</p>}
      {pending.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Forwarded emails waiting">
          {pending.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
              <Inbox className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{item.summary || item.subject}</span>
                <span className="block text-xs text-muted">Forwarded by {item.sender} · “{item.subject}”</span>
              </span>
              {!readOnly && (
                <span className="flex gap-1.5">
                  <button type="button" disabled={busy === item.id} className="btn-dark px-3 py-1.5 text-xs" onClick={() => resolve(item, "apply")}>Add to trip</button>
                  <button type="button" disabled={busy === item.id} className="btn-ghost px-3 py-1.5 text-xs" onClick={() => resolve(item, "dismiss")}>Dismiss</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
