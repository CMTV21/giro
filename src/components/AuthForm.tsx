"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CURRENCIES, CURRENCY_NAMES } from "@/lib/currency";
import { useSession } from "./SessionProvider";

/** Only same-site paths are allowed as post-login destinations (no open redirects). */
export function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/trips";
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { signIn } = useSession();
  const [fields, setFields] = useState({ name: "", email: "", password: "", homeCurrency: "CAD" });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFields({ ...fields, [k]: e.target.value });

  return (
    <form
      className="card space-y-4 p-6 sm:p-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(undefined);
        const payload = mode === "signup" ? fields : { email: fields.email, password: fields.password };
        const res = await signIn(mode, payload);
        if (res.error) {
          setError(res.error);
          setBusy(false);
          return;
        }
        router.replace(next);
      }}
    >
      {mode === "signup" && (
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" className="field" autoComplete="name" value={fields.name} onChange={set("name")} maxLength={80} required />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" className="field" autoComplete="email" value={fields.email} onChange={set("email")} required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" type="password" className="field" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={fields.password} onChange={set("password")} minLength={mode === "signup" ? 10 : undefined} required />
        {mode === "signup" && <p className="mt-1.5 text-xs text-muted">At least 10 characters. A short phrase works well.</p>}
        {mode === "login" && <Link href="/forgot" className="mt-1.5 inline-block text-xs font-semibold text-brand">Forgot password?</Link>}
      </div>
      {mode === "signup" && (
        <div>
          <label className="label" htmlFor="currency">Home currency</label>
          <select id="currency" className="field" value={fields.homeCurrency} onChange={set("homeCurrency")}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c} · {CURRENCY_NAMES[c]}</option>)}
          </select>
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-dark">{error}</p>}
      <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {mode === "signup" ? "Create account" : "Sign in"} <ArrowRight className="h-4 w-4" />
      </button>
      <p className="text-center text-sm text-muted">
        {mode === "signup" ? "Already have an account? " : "New to Giro? "}
        <Link className="font-semibold text-brand" href={`/${mode === "signup" ? "login" : "signup"}?next=${encodeURIComponent(next)}`}>
          {mode === "signup" ? "Sign in" : "Create an account"}
        </Link>
      </p>
      <p className="text-center text-xs text-muted">Trips and preferences from this browser move to your account automatically.</p>
      {mode === "signup" && (
        <p className="text-center text-xs text-muted">
          By creating an account you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      )}
    </form>
  );
}
