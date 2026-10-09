"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Currency } from "@/lib/currency";
import { importLocalTrips } from "@/lib/storage";
import { mergeTaste, parseTaste } from "@/lib/taste";
import { loadTaste, saveTaste } from "@/lib/taste-client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  homeCurrency: Currency;
  homeAirport: string;
  isAdmin: boolean;
}

interface Session {
  user: SessionUser | null | undefined;
  refresh: () => Promise<SessionUser | null>;
  signIn: (mode: "login" | "signup", fields: Record<string, string>) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  setUser: (u: SessionUser) => void;
}

const Ctx = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession must be used inside SessionProvider");
  return s;
}

/** Bring this browser's taste profile and trips into the account after signing in. */
async function adoptLocalData(serverTaste: unknown) {
  const local = loadTaste();
  const remote = parseTaste(serverTaste);
  const merged = remote ? mergeTaste(local, remote) : local;
  saveTaste(merged, { sync: merged.events > 0 });
  await importLocalTrips();
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      const json = res.ok ? ((await res.json()) as { user: SessionUser | null; taste?: unknown }) : { user: null };
      setUser(json.user);
      if (json.user && json.taste) {
        const remote = parseTaste(json.taste);
        if (remote && remote.events > loadTaste().events) saveTaste(remote, { sync: false });
      }
      return json.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(async (mode: "login" | "signup", fields: Record<string, string>) => {
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fields) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (json as { message?: string }).message ?? "Something went wrong." };
    setUser((json as { user: SessionUser }).user);
    const me = await fetch("/api/me", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    await adoptLocalData((me as { taste?: unknown }).taste);
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, refresh, signIn, signOut, setUser }}>{children}</Ctx.Provider>;
}
