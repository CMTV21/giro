"use client";

import type { ClientEvent } from "./pass";

/** Report an anonymous launch-funnel event. Fire-and-forget: it never delays or breaks the page. */
export function track(kind: ClientEvent, tripId?: string, detail?: Record<string, number | boolean | string>): void {
  try {
    void fetch("/api/funnel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, tripId, detail }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* measurement is optional */
  }
}
