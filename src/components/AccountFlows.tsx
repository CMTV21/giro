"use client";

import { ArrowRight, CheckCircle2, LoaderCircle, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/storage";
import { useSession, type SessionUser } from "./SessionProvider";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string>();

  if (state === "sent") {
    return (
      <div className="card p-6 text-center sm:p-8">
        <MailCheck className="mx-auto h-10 w-10 text-sea" />
        <p className="mt-3 font-semibold">Check your inbox</p>
        <p className="mt-1 text-sm text-muted">If an account exists for {email}, we&apos;ve sent a link to reset your password. It expires in one hour.</p>
        <Link href="/login" className="btn-ghost mt-6">Back to sign in</Link>
      </div>
    );
  }
  return (
    <form
      className="card space-y-4 p-6 sm:p-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        setError(undefined);
        try {
          await api("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
          setState("sent");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
          setState("idle");
        }
      }}
    >
      <div>
        <label className="label" htmlFor="forgot-email">Email</label>
        <input id="forgot-email" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      {error && <p role="alert" className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-dark">{error}</p>}
      <button type="submit" className="btn-primary w-full py-3" disabled={state === "busy"}>
        {state === "busy" && <LoaderCircle className="h-4 w-4 animate-spin" />} Email me a reset link
      </button>
      <p className="text-center text-sm text-muted">Remembered it? <Link className="font-semibold text-brand" href="/login">Sign in</Link></p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const { setUser } = useSession();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <form
      className="card space-y-4 p-6 sm:p-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
          const { user } = await api<{ user: SessionUser }>("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) });
          setUser(user);
          router.replace("/trips");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
          setBusy(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="new-password">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" minLength={10} className="field" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <p className="mt-1.5 text-xs text-muted">At least 10 characters. You&apos;ll be signed out on other devices.</p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-dark">
          {error} {/expired|used/.test(error) && <Link href="/forgot" className="font-semibold underline">Get a new link</Link>}
        </p>
      )}
      <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Save new password <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

export function VerifyEmail({ token }: { token: string }) {
  const { refresh } = useSession();
  const [state, setState] = useState<"busy" | "done" | "error">("busy");
  const [error, setError] = useState<string>();
  const started = useRef(false);
  useEffect(() => {
    // Strict mode runs effects twice in development; a token can only be used once.
    if (started.current) return;
    started.current = true;
    api("/api/auth/verify", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => {
        setState("done");
        refresh();
      })
      .catch((err: Error) => {
        setError(err.message);
        setState("error");
      });
  }, [token, refresh]);

  return (
    <div className="card p-8 text-center">
      {state === "busy" && <p className="animate-pulse text-muted">Confirming your email…</p>}
      {state === "done" && (
        <>
          <CheckCircle2 className="mx-auto h-10 w-10 text-sea" />
          <p className="mt-3 font-display text-2xl font-semibold">Email confirmed</p>
          <p className="mt-1 text-muted">You&apos;re all set.</p>
          <Link href="/plan" className="btn-primary mt-6">Plan a trip</Link>
        </>
      )}
      {state === "error" && (
        <>
          <p className="font-display text-2xl font-semibold">That link didn&apos;t work</p>
          <p className="mt-1 text-muted">{error} You can send a new one from your account page.</p>
          <Link href="/account" className="btn-ghost mt-6">Go to account</Link>
        </>
      )}
    </div>
  );
}

export function VerifyBanner() {
  const { user } = useSession();
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string>();
  if (!user || user.emailVerified) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <MailCheck className="h-4 w-4 shrink-0" />
      <span>Confirm <span className="font-semibold">{user.email}</span> to receive trip invites and account emails.</span>
      <button
        type="button"
        className="ml-auto font-semibold underline disabled:opacity-50"
        disabled={state === "busy" || state === "sent"}
        onClick={async () => {
          setState("busy");
          try {
            const res = await api<{ sent?: boolean; reason?: string }>("/api/me/verify", { method: "POST" });
            setState(res.sent || res.reason === "dev_logged" ? "sent" : "error");
            if (!res.sent && res.reason === "not_configured") setMessage("Email sending isn't set up yet.");
          } catch (err) {
            setState("error");
            setMessage(err instanceof Error ? err.message : undefined);
          }
        }}
      >
        {state === "sent" ? "Sent, check your inbox" : state === "busy" ? "Sending…" : "Resend email"}
      </button>
      {state === "error" && message && <span className="w-full text-xs">{message}</span>}
    </div>
  );
}
